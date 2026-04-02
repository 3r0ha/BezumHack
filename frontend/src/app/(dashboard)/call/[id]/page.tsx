"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Phone,
  MessageSquare,
  X,
  Send,
  Copy,
  Check,
  Users,
  UserX,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { io as socketIo } from "socket.io-client";
import { useUsers } from "@/hooks/use-users";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PeerData {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
}

interface ChatMessage {
  userId: string;
  content: string;
  timestamp: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name[0]?.toUpperCase() || "?";
}

function formatChatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── ICE Config ────────────────────────────────────────────────────────────────

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;
  const { user } = useAuth();
  const { t } = useLocale();
  const { getUserName } = useUsers();

  // Direct socket connection (not useSocket — need dedicated connection for call)
  const socketRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
  }, []);
  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (handler) socketRef.current?.off(event, handler);
    else socketRef.current?.off(event);
  }, []);

  const socket = socketRef.current;

  // ─── State ─────────────────────────────────────────────────────────────────

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerData>>(new Map());
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // ─── Create Peer Connection ────────────────────────────────────────────────

  const createPeerConnection = useCallback(
    (peerId: string, stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local tracks to the connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          emit("call.ice-candidate", {
            callId,
            targetUserId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          setPeers((prev) => {
            const next = new Map(prev);
            const existing = next.get(peerId);
            if (existing) {
              next.set(peerId, { ...existing, stream: remoteStream });
            } else {
              next.set(peerId, { pc, stream: remoteStream });
            }
            return next;
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          // Clean up failed connection
          pc.close();
          peerConnectionsRef.current.delete(peerId);
          setPeers((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        }
      };

      // Store the connection
      peerConnectionsRef.current.set(peerId, pc);
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(peerId, { pc, stream: null });
        return next;
      });

      return pc;
    },
    [callId, emit]
  );

  // ─── Initialize Media & Socket ─────────────────────────────────────────────

  useEffect(() => {
    if (!user) return; // Wait for auth
    if (socketRef.current) return; // Already initialized
    let cancelled = false;

    async function init() {
      // 1. Get media
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setIsCameraOff(true);
        } catch {
          setIsCameraOff(true);
          setIsMuted(true);
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }

      // 2. Connect socket
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const s = socketIo(window.location.origin, {
        auth: { token: token || undefined, name: user?.name || undefined },
        transports: ["websocket", "polling"],
      });

      socketRef.current = s;

      s.on("connect", () => {
        console.log("[Call] Socket connected:", s.id);
        setIsConnected(true);
        setIsConnecting(false);
      });

      s.on("disconnect", () => {
        setIsConnected(false);
      });
    }

    init();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ─── Join Call Room via Socket ─────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !isConnected || !user || isConnecting) return;

    emit("call.join", { callId, userId: user.id, userName: user.name });

    return () => {
      emit("call.leave", { callId, userId: user.id });
    };
  }, [socket, isConnected, user, callId, emit, isConnecting]);

  // ─── Socket Event Handlers ────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !isConnected || !user) return;

    const stream = localStreamRef.current;

    // When a new user joins, we (the existing user) create an offer
    const handleUserJoined = async (data: { userId: string; userName?: string }) => {
      if (data.userId === user.id || !stream) return;
      if (data.userName) {
        setPeerNames(prev => ({ ...prev, [data.userId]: data.userName! }));
      }

      const pc = createPeerConnection(data.userId, stream);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit("call.offer", {
          callId,
          targetUserId: data.userId,
          offer: pc.localDescription?.toJSON(),
        });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    };

    // When receiving an offer, create an answer
    const handleOffer = async (data: {
      fromUserId: string;
      fromUserName?: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (data.fromUserId === user.id || !stream) return;
      if (data.fromUserName) {
        setPeerNames(prev => ({ ...prev, [data.fromUserId]: data.fromUserName! }));
      }

      let pc = peerConnectionsRef.current.get(data.fromUserId);
      if (!pc) {
        pc = createPeerConnection(data.fromUserId, stream);
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit("call.answer", {
          callId,
          targetUserId: data.fromUserId,
          answer: pc.localDescription?.toJSON(),
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    };

    // When receiving an answer
    const handleAnswer = async (data: {
      fromUserId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    };

    // When receiving an ICE candidate
    const handleIceCandidate = async (data: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (!pc) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    };

    // When a user leaves
    const handleUserLeft = (data: { userId: string }) => {
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.userId);
      }
      setPeers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    };

    // When the call is ended by someone
    const handleCallEnded = () => {
      cleanupAndLeave();
    };

    // When receiving a chat message
    const handleChat = (data: ChatMessage) => {
      setChatMessages((prev) => [...prev, data]);
      if (!showChat) {
        setUnreadMessages((prev) => prev + 1);
      }
    };

    on("call.user-joined", handleUserJoined);
    on("call.offer", handleOffer);
    on("call.answer", handleAnswer);
    on("call.ice-candidate", handleIceCandidate);
    on("call.user-left", handleUserLeft);
    on("call.ended", handleCallEnded);
    on("call.chat", handleChat);

    return () => {
      off("call.user-joined", handleUserJoined);
      off("call.offer", handleOffer);
      off("call.answer", handleAnswer);
      off("call.ice-candidate", handleIceCandidate);
      off("call.user-left", handleUserLeft);
      off("call.ended", handleCallEnded);
      off("call.chat", handleChat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isConnected, user, callId, emit, on, off, createPeerConnection, showChat]);

  // ─── Scroll chat to bottom on new messages ────────────────────────────────

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // ─── Cleanup on Unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Stop all local tracks
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, []);

  // ─── Control Handlers ─────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsCameraOff((prev) => !prev);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        setScreenStream(null);
      }

      // Replace screen track with camera track in all peer connections
      const stream = localStreamRef.current;
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          });
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }

      setIsScreenSharing(false);
    } else {
      // Start screen sharing
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        setScreenStream(screen);

        const screenTrack = screen.getVideoTracks()[0];

        // Replace camera track with screen track in all peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack);
          } else {
            // No video sender (camera was off) — add screen track
            pc.addTrack(screenTrack, screen);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screen;
        }

        // Handle user stopping screen share via browser UI
        screenTrack.onended = () => {
          const stream = localStreamRef.current;
          if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              peerConnectionsRef.current.forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                if (sender) {
                  sender.replaceTrack(videoTrack);
                }
              });
            }

            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          }

          setScreenStream(null);
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      } catch {
        // User cancelled screen sharing dialog
      }
    }
  }, [isScreenSharing, screenStream]);

  const toggleChat = useCallback(() => {
    setShowChat((prev) => {
      if (!prev) {
        setUnreadMessages(0);
      }
      return !prev;
    });
  }, []);

  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !user) return;

    const msg: ChatMessage = {
      userId: user.id,
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    emit("call.chat", { callId, ...msg });
    setChatMessages((prev) => [...prev, msg]);
    setChatInput("");
  }, [chatInput, user, callId, emit]);

  const cleanupAndLeave = useCallback(() => {
    // Stop all local tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    setPeers(new Map());
    setLocalStream(null);
    setScreenStream(null);

    router.push("/chat");
  }, [router, screenStream]);

  const endCall = useCallback(() => {
    emit("call.leave", { callId, userId: user?.id });
    cleanupAndLeave();
  }, [callId, user, emit, cleanupAndLeave]);

  const endCallForAll = useCallback(() => {
    emit("call.end", { callId });
    cleanupAndLeave();
  }, [callId, emit, cleanupAndLeave]);

  const copyInviteLink = useCallback(() => {
    const url = `${window.location.origin}/meet/${callId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [callId]);

  // ─── Grid Layout ──────────────────────────────────────────────────────────

  const totalParticipants = 1 + peers.size;
  const gridClass =
    totalParticipants <= 1
      ? "grid-cols-1 max-w-2xl mx-auto"
      : totalParticipants <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : totalParticipants <= 4
      ? "grid-cols-2"
      : "grid-cols-2 sm:grid-cols-3";

  const initials = user?.name ? getUserInitials(user.name) : "?";

  // ─── Connecting State ─────────────────────────────────────────────────────

  if (isConnecting) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Phone className="h-8 w-8 text-primary" />
          </div>
          <p className="text-white/70 text-sm">{t("call.connecting")}</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col z-50">
      {/* Video grid area */}
      <div
        className={`flex-1 p-2 sm:p-4 overflow-hidden transition-all duration-300 ${
          showChat ? "mr-0 sm:mr-[320px]" : ""
        }`}
      >
        <div className={`grid gap-2 h-full auto-rows-fr ${gridClass}`}>
          {/* Local video */}
          <div className="relative rounded-xl overflow-hidden bg-[#1a1a1a] min-h-0">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full ${isScreenSharing ? "object-contain bg-black" : "object-cover"} ${
                isCameraOff && !isScreenSharing ? "hidden" : ""
              }`}
            />
            {isCameraOff && !isScreenSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                  <AvatarFallback className="text-xl sm:text-2xl bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-white flex items-center gap-1.5">
              <span>
                {user?.name || t("call.you")} ({t("call.you")})
              </span>
              {isMuted && (
                <MicOff className="h-3 w-3 text-red-400" />
              )}
            </div>
            {isScreenSharing && (
              <div className="absolute top-2 left-2 bg-blue-500/80 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-white">
                {t("call.share_screen")}
              </div>
            )}
          </div>

          {/* Remote videos */}
          {Array.from(peers.entries()).map(([peerId, peer]) => {
            const peerName = peerNames[peerId] || getUserName(peerId);
            const hasVideo = peer.stream && peer.stream.getVideoTracks().length > 0;
            return (
            <div
              key={peerId}
              className="relative rounded-xl overflow-hidden bg-[#1a1a1a] min-h-0"
            >
              {/* Avatar background — always visible behind video */}
              <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] z-0">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                  <AvatarFallback className="text-xl sm:text-2xl bg-primary/10 text-primary">
                    {getUserInitials(peerName)}
                  </AvatarFallback>
                </Avatar>
              </div>
              {/* Video overlay — on top of avatar */}
              {hasVideo && (
                <video
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain bg-black z-10"
                  ref={(el) => {
                    if (el && peer.stream) {
                      el.srcObject = peer.stream;
                    }
                  }}
                />
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-white z-20">
                {peerName}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Controls bar */}
      <div
        className={`flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-[#0a0a0a] border-t border-white/5 transition-all duration-300 ${
          showChat ? "mr-0 sm:mr-[320px]" : ""
        }`}
      >
        {/* Mute */}
        <button
          onClick={toggleMute}
          title={isMuted ? t("call.unmute") : t("call.mute")}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-colors ${
            isMuted
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Camera */}
        <button
          onClick={toggleCamera}
          title={isCameraOff ? t("call.camera_on") : t("call.camera_off")}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-colors ${
            isCameraOff
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isCameraOff ? (
            <VideoOff className="h-5 w-5" />
          ) : (
            <Video className="h-5 w-5" />
          )}
        </button>

        {/* Screen share */}
        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? t("call.stop_sharing") : t("call.share_screen")}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-colors ${
            isScreenSharing
              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isScreenSharing ? (
            <MonitorOff className="h-5 w-5" />
          ) : (
            <Monitor className="h-5 w-5" />
          )}
        </button>

        {/* Chat toggle */}
        <button
          onClick={toggleChat}
          title={t("call.chat")}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-colors relative ${
            showChat
              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <MessageSquare className="h-5 w-5" />
          {unreadMessages > 0 && !showChat && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </button>

        {/* Participants */}
        <button
          onClick={() => { setShowParticipants(!showParticipants); if (showChat) setShowChat(false); }}
          title="Participants"
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-colors relative ${
            showParticipants ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 bg-white/20 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {1 + peers.size}
          </span>
        </button>

        {/* Copy invite link */}
        <button
          onClick={copyInviteLink}
          title={linkCopied ? "Copied!" : "Copy invite link"}
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-colors bg-white/10 text-white hover:bg-white/20"
        >
          {linkCopied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
        </button>

        {/* End call */}
        <button
          onClick={endCall}
          title={t("call.end")}
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-colors ml-2"
        >
          <Phone className="h-5 w-5 rotate-[135deg]" />
        </button>
      </div>

      {/* Chat panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full sm:w-[320px] bg-[#111111] border-l border-white/10 flex flex-col transition-transform duration-300 z-50 ${
          showChat ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Chat header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 shrink-0">
          <span className="font-medium text-sm text-white">{t("call.chat")}</span>
          <button
            onClick={toggleChat}
            className="h-8 w-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chat messages */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-3"
        >
          {chatMessages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/30 text-sm text-center">
                {t("chat.no_messages")}
              </p>
            </div>
          )}
          {chatMessages.map((msg, idx) => {
            const isMe = msg.userId === user?.id;
            const senderName = isMe
              ? user?.name || t("call.you")
              : getUserName(msg.userId);
            return (
              <div key={idx} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-medium ${
                      isMe ? "text-primary" : "text-white/70"
                    }`}
                  >
                    {senderName}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {formatChatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-white/90 break-words">
                  {msg.content}
                </p>
              </div>
            );
          })}
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              placeholder={t("chat.type_message")}
              className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm h-9"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {/* Participants panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full sm:w-[320px] bg-[#111111] border-l border-white/10 flex flex-col transition-transform duration-300 z-50 ${
          showParticipants ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">
            Participants ({1 + peers.size})
          </h3>
          <button onClick={() => setShowParticipants(false)} className="text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1">
            {/* Self */}
            <div className="flex items-center gap-3 p-2 rounded-lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getUserInitials(user?.name || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{user?.name} (You)</p>
              </div>
              <div className="flex gap-1">
                {isMuted && <MicOff className="h-3.5 w-3.5 text-red-400" />}
                {isCameraOff && <VideoOff className="h-3.5 w-3.5 text-red-400" />}
              </div>
            </div>

            {/* Peers */}
            {Array.from(peers.keys()).map((peerId) => {
              const name = peerNames[peerId] || getUserName(peerId);
              return (
                <div key={peerId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getUserInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{name}</p>
                  </div>
                  {user && (
                    <button
                      onClick={() => {
                        emit("call.kick", { callId, targetUserId: peerId });
                        const pc = peerConnectionsRef.current.get(peerId);
                        if (pc) { pc.close(); peerConnectionsRef.current.delete(peerId); }
                        setPeers(prev => { const n = new Map(prev); n.delete(peerId); return n; });
                      }}
                      className="text-white/30 hover:text-red-400 transition-colors"
                      title="Remove from call"
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
