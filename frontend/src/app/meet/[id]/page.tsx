"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Phone,
  MessageSquare,
  Send,
  Copy,
  Check,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { io, Socket } from "socket.io-client";

// --- Types ---

interface PeerData {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
}

interface ChatMessage {
  userId: string;
  content: string;
  timestamp: string;
}

// --- Helpers ---

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

function generateGuestId(): string {
  return `guest-${Math.random().toString(36).substring(2, 10)}`;
}

// --- ICE Config ---

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// --- Component ---

export default function MeetPage() {
  const params = useParams();
  const callId = params.id as string;

  // Guest identity
  const [guestName, setGuestName] = useState("");
  const [guestId] = useState(() => generateGuestId());
  const [joined, setJoined] = useState(false);

  // Lobby preview
  const previewRef = useRef<HTMLVideoElement>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [previewCameraOff, setPreviewCameraOff] = useState(false);

  // Call state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerData>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // --- Lobby: Start camera preview ---

  useEffect(() => {
    if (joined) return;
    let cancelled = false;

    async function startPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setPreviewStream(stream);
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
      } catch {
        // Camera not available, that's OK
      }
    }

    startPreview();

    return () => {
      cancelled = true;
    };
  }, [joined]);

  // Cleanup preview stream when leaving lobby
  useEffect(() => {
    return () => {
      previewStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePreviewMic = () => {
    if (!previewStream) return;
    const audioTracks = previewStream.getAudioTracks();
    audioTracks.forEach((t) => {
      t.enabled = !t.enabled;
    });
    setPreviewMuted((prev) => !prev);
  };

  const togglePreviewCamera = () => {
    if (!previewStream) return;
    const videoTracks = previewStream.getVideoTracks();
    videoTracks.forEach((t) => {
      t.enabled = !t.enabled;
    });
    setPreviewCameraOff((prev) => !prev);
  };

  // --- Create Peer Connection ---

  const createPeerConnection = useCallback(
    (peerId: string, stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("call.ice-candidate", {
            callId,
            targetUserId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

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

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          pc.close();
          peerConnectionsRef.current.delete(peerId);
          setPeers((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        }
      };

      peerConnectionsRef.current.set(peerId, pc);
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(peerId, { pc, stream: null });
        return next;
      });

      return pc;
    },
    [callId]
  );

  // --- Join Call ---

  const joinCall = useCallback(() => {
    // Stop preview stream
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
    }

    const socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
      auth: {
        guestId,
        guestName: guestName.trim(),
      },
    });
    socketRef.current = socket;

    socket.on("connect", async () => {
      // Get media with the same mute/camera preferences from lobby
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          setIsCameraOff(true);
        } catch {
          setIsCameraOff(true);
          setIsMuted(true);
        }
      }

      if (stream) {
        // Apply lobby preferences
        if (previewMuted) {
          stream.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
          setIsMuted(true);
        }
        if (previewCameraOff) {
          stream.getVideoTracks().forEach((t) => {
            t.enabled = false;
          });
          setIsCameraOff(true);
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }

      socket.emit("call.join", { callId, userId: guestId, userName: guestName });
      setJoined(true);
    });

    // --- Socket event handlers ---

    socket.on(
      "call.user-joined",
      async (data: { userId: string; callId: string }) => {
        if (data.userId === guestId) return;
        const stream = localStreamRef.current;
        if (!stream) return;

        setParticipantCount((c) => c + 1);

        const pc = createPeerConnection(data.userId, stream);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call.offer", {
            callId,
            targetUserId: data.userId,
            offer: pc.localDescription?.toJSON(),
          });
        } catch (err) {
          console.error("Error creating offer:", err);
        }
      }
    );

    socket.on(
      "call.offer",
      async (data: {
        fromUserId: string;
        offer: RTCSessionDescriptionInit;
      }) => {
        if (data.fromUserId === guestId) return;
        const stream = localStreamRef.current;
        if (!stream) return;

        let pc = peerConnectionsRef.current.get(data.fromUserId);
        if (!pc) {
          pc = createPeerConnection(data.fromUserId, stream);
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call.answer", {
            callId,
            targetUserId: data.fromUserId,
            answer: pc.localDescription?.toJSON(),
          });
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      }
    );

    socket.on(
      "call.answer",
      async (data: {
        fromUserId: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        const pc = peerConnectionsRef.current.get(data.fromUserId);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } catch (err) {
          console.error("Error handling answer:", err);
        }
      }
    );

    socket.on(
      "call.ice-candidate",
      async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
        const pc = peerConnectionsRef.current.get(data.fromUserId);
        if (!pc) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }
    );

    socket.on("call.user-left", (data: { userId: string }) => {
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
      setParticipantCount((c) => Math.max(0, c - 1));
    });

    socket.on("call.ended", () => {
      cleanupCall();
      setCallEnded(true);
    });

    socket.on("call.chat", (data: ChatMessage) => {
      setChatMessages((prev) => [...prev, data]);
      setUnreadMessages((prev) => prev + 1);
    });

    socket.on("disconnect", () => {
      // Could reconnect, but for now just note it
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, guestId, guestName, previewMuted, previewCameraOff, previewStream, createPeerConnection]);

  // --- Scroll chat ---

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // --- Cleanup on unmount ---

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      socketRef.current?.disconnect();
    };
  }, []);

  // --- Controls ---

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsCameraOff((prev) => !prev);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        setScreenStream(null);
      }
      const stream = localStreamRef.current;
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc
              .getSenders()
              .find((s) => s.track?.kind === "video");
            if (sender) sender.replaceTrack(videoTrack);
          });
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        setScreenStream(screen);
        const screenTrack = screen.getVideoTracks()[0];

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screen;
        }

        screenTrack.onended = () => {
          const stream = localStreamRef.current;
          if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              peerConnectionsRef.current.forEach((pc) => {
                const sender = pc
                  .getSenders()
                  .find((s) => s.track?.kind === "video");
                if (sender) sender.replaceTrack(videoTrack);
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
        // User cancelled
      }
    }
  }, [isScreenSharing, screenStream]);

  const toggleChat = useCallback(() => {
    setShowChat((prev) => {
      if (!prev) setUnreadMessages(0);
      return !prev;
    });
  }, []);

  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    const msg: ChatMessage = {
      userId: guestId,
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    socketRef.current?.emit("call.chat", { callId, ...msg });
    setChatMessages((prev) => [...prev, msg]);
    setChatInput("");
  }, [chatInput, guestId, callId]);

  const cleanupCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setPeers(new Map());
    setLocalStream(null);
    setScreenStream(null);
  }, [screenStream]);

  const leaveCall = useCallback(() => {
    socketRef.current?.emit("call.leave", { callId, userId: guestId });
    cleanupCall();
    socketRef.current?.disconnect();
    setCallEnded(true);
  }, [callId, guestId, cleanupCall]);

  const copyInviteLink = useCallback(() => {
    const url = `${window.location.origin}/meet/${callId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [callId]);

  // --- Call ended screen ---

  if (callEnded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <Phone className="h-8 w-8 text-white/30 rotate-[135deg]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Call ended</h1>
            <p className="text-white/50 mt-2">
              You have left the call.
            </p>
          </div>
          <Button
            onClick={() => {
              setCallEnded(false);
              setJoined(false);
            }}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700"
          >
            Rejoin
          </Button>
        </div>
      </div>
    );
  }

  // --- Lobby screen (before joining) ---

  if (!joined) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Envelope Meet</h1>
            <p className="text-white/50 mt-1">Join the call</p>
          </div>

          {/* Camera preview */}
          <div className="aspect-video rounded-xl bg-white/5 overflow-hidden relative">
            <video
              ref={previewRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${
                previewCameraOff ? "hidden" : ""
              }`}
            />
            {(!previewStream || previewCameraOff) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoOff className="h-10 w-10 text-white/30" />
              </div>
            )}
          </div>

          <Input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && guestName.trim()) {
                joinCall();
              }
            }}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePreviewMic}
              className="border-white/10 text-white hover:bg-white/10"
            >
              {previewMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={togglePreviewCamera}
              className="border-white/10 text-white hover:bg-white/10"
            >
              {previewCameraOff ? (
                <VideoOff className="h-5 w-5" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700"
              disabled={!guestName.trim()}
              onClick={joinCall}
            >
              Join Call
            </Button>
          </div>

          {/* Copy invite link */}
          <button
            onClick={copyInviteLink}
            className="w-full flex items-center justify-center gap-2 text-white/40 hover:text-white/60 text-sm transition-colors py-2"
          >
            {linkCopied ? (
              <>
                <Check className="h-4 w-4" />
                <span>Link copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy invite link</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- Call UI (after joining) ---

  const totalParticipants = 1 + peers.size;
  const gridClass =
    totalParticipants <= 1
      ? "grid-cols-1 max-w-2xl mx-auto"
      : totalParticipants <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : totalParticipants <= 4
      ? "grid-cols-2"
      : "grid-cols-2 sm:grid-cols-3";

  const initials = guestName ? getUserInitials(guestName) : "?";

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col z-50">
      {/* Top bar */}
      <div
        className={`flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-white/5 transition-all duration-300 ${
          showChat ? "mr-0 sm:mr-[320px]" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">E</span>
          </div>
          <span className="text-white/70 text-sm font-medium">
            Envelope Meet
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-white/40 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span>{totalParticipants}</span>
          </div>
          <button
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/60 text-xs transition-colors px-2 py-1 rounded-md hover:bg-white/5"
          >
            {linkCopied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Invite</span>
              </>
            )}
          </button>
        </div>
      </div>

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
                  <AvatarFallback className="text-xl sm:text-2xl bg-indigo-500/10 text-indigo-400">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-white flex items-center gap-1.5">
              <span>{guestName} (You)</span>
              {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
            </div>
            {isScreenSharing && (
              <div className="absolute top-2 left-2 bg-blue-500/80 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-white">
                Screen sharing
              </div>
            )}
          </div>

          {/* Remote videos */}
          {Array.from(peers.entries()).map(([peerId, peer]) => (
            <div
              key={peerId}
              className="relative rounded-xl overflow-hidden bg-[#1a1a1a] min-h-0"
            >
              <video
                autoPlay
                playsInline
                className={`w-full h-full object-contain bg-black ${
                  !peer.stream ? "hidden" : ""
                }`}
                ref={(el) => {
                  if (el && peer.stream) {
                    el.srcObject = peer.stream;
                  }
                }}
              />
              {!peer.stream && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
                  <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                    <AvatarFallback className="text-xl sm:text-2xl bg-indigo-500/10 text-indigo-400">
                      {getUserInitials(peerId)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-white">
                {peerId}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls bar */}
      <div
        className={`flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-[#0a0a0a] border-t border-white/5 transition-all duration-300 ${
          showChat ? "mr-0 sm:mr-[320px]" : ""
        }`}
      >
        <button
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-colors ${
            isMuted
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isMuted ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={toggleCamera}
          title={isCameraOff ? "Turn camera on" : "Turn camera off"}
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

        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
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

        <button
          onClick={toggleChat}
          title="Chat"
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

        <button
          onClick={leaveCall}
          title="Leave call"
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
        <div className="flex items-center justify-between p-3 border-b border-white/10 shrink-0">
          <span className="font-medium text-sm text-white">Chat</span>
          <button
            onClick={toggleChat}
            className="h-8 w-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-3"
        >
          {chatMessages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/30 text-sm text-center">
                No messages yet
              </p>
            </div>
          )}
          {chatMessages.map((msg, idx) => {
            const isMe = msg.userId === guestId;
            const senderName = isMe ? guestName : msg.userId;
            return (
              <div key={idx} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-medium ${
                      isMe ? "text-indigo-400" : "text-white/70"
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
              placeholder="Type a message..."
              className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm h-9"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              className="h-9 w-9 rounded-lg flex items-center justify-center bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
