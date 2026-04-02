"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MousePointer2,
  StickyNote,
  Square,
  Circle,
  Type,
  Minus,
  ArrowRight,
  Pencil,
  Eraser,
  ZoomIn,
  ZoomOut,
  Undo,
  Trash2,
  Palette,
  Save,
  ArrowLeft,
  Hand,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useUsers } from "@/hooks/use-users";
import { io, Socket } from "socket.io-client";

// ─── Types ───────────────────────────────────────────────────────────

interface BoardElement {
  id: string;
  type: "sticky" | "rect" | "circle" | "text" | "line" | "arrow" | "draw";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string;
  color: string;
  fontSize: number;
  properties: Record<string, any>;
  zIndex: number;
}

type Tool =
  | "select"
  | "sticky"
  | "rect"
  | "circle"
  | "text"
  | "line"
  | "arrow"
  | "draw"
  | "eraser";

interface CursorInfo {
  x: number;
  y: number;
  name: string;
  color: string;
}

interface DragState {
  id: string;
  startX: number;
  startY: number;
  elemX: number;
  elemY: number;
}

interface ResizeState {
  id: string;
  handle: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

interface CreateState {
  startX: number;
  startY: number;
}

interface LineCreateState {
  startX: number;
  startY: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const COLORS = [
  "#fef08a",
  "#fca5a5",
  "#93c5fd",
  "#86efac",
  "#d8b4fe",
  "#fdba74",
  "#f9a8d4",
  "#ffffff",
];

const CURSOR_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

// ─── Helpers ─────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function screenToCanvas(
  sx: number,
  sy: number,
  pan: { x: number; y: number },
  zoom: number,
  rect: DOMRect
) {
  return {
    x: (sx - rect.left - pan.x) / zoom,
    y: (sy - rect.top - pan.y) / zoom,
  };
}

// ─── Arrow head helper ───────────────────────────────────────────────

function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number = 12
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const p1x = x2 - size * Math.cos(angle - Math.PI / 6);
  const p1y = y2 - size * Math.sin(angle - Math.PI / 6);
  const p2x = x2 - size * Math.cos(angle + Math.PI / 6);
  const p2y = y2 - size * Math.sin(angle + Math.PI / 6);
  return `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`;
}

// ─── Main Component ─────────────────────────────────────────────────

export default function BoardCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = params.id as string;
  const { user } = useAuth();
  const { t } = useLocale();
  const { getUserName } = useUsers();

  // ─── State ──────────────────────────────────────────────────────

  const [elements, setElements] = useState<BoardElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panStartOffset, setPanStartOffset] = useState({ x: 0, y: 0 });
  const [cursors, setCursors] = useState<Map<string, CursorInfo>>(new Map());
  const [boardTitle, setBoardTitle] = useState("Untitled Board");
  const [currentColor, setCurrentColor] = useState("#fef08a");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [undoStack, setUndoStack] = useState<BoardElement[][]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [lineCreateState, setLineCreateState] = useState<LineCreateState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [tempElement, setTempElement] = useState<BoardElement | null>(null);
  const [boardCreatedBy, setBoardCreatedBy] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const cursorThrottleRef = useRef<number>(0);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Selected element ──────────────────────────────────────────

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) || null,
    [elements, selectedId]
  );

  // ─── Undo helper ──────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => {
      const next = [...prev, elements.map((el) => ({ ...el, properties: { ...el.properties } }))];
      if (next.length > 50) next.shift();
      return next;
    });
  }, [elements]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setElements(last);
      setSelectedId(null);
      return next;
    });
  }, []);

  // ─── Element CRUD ─────────────────────────────────────────────

  const addElement = useCallback(
    (el: BoardElement) => {
      pushUndo();
      setElements((prev) => [...prev, el]);
      socketRef.current?.emit("board.element.created", { boardId, element: el });
      // Save to API
      api.post(`/api/projects/boards/${boardId}/elements`, el).catch(() => {});
    },
    [boardId, pushUndo]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<BoardElement>) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
      );
      socketRef.current?.emit("board.element.updated", {
        boardId,
        elementId: id,
        updates,
      });
      api
        .patch(`/api/projects/boards/${boardId}/elements/${id}`, updates)
        .catch(() => {});
    },
    [boardId]
  );

  const deleteElement = useCallback(
    (id: string) => {
      pushUndo();
      setElements((prev) => prev.filter((el) => el.id !== id));
      if (selectedId === id) setSelectedId(null);
      socketRef.current?.emit("board.element.deleted", {
        boardId,
        elementId: id,
      });
      api
        .delete(`/api/projects/boards/${boardId}/elements/${id}`)
        .catch(() => {});
    },
    [boardId, selectedId, pushUndo]
  );

  // ─── Load board data ─────────────────────────────────────────

  useEffect(() => {
    async function loadBoard() {
      try {
        const data = await api.get<any>(`/api/projects/boards/${boardId}`);
        if (data) {
          const board = data.board || data;
          setBoardTitle(board.title || "Untitled Board");
          setBoardCreatedBy(board.createdBy || null);
          if (board.elements) {
            setElements(board.elements);
          }
        }
      } catch {
        // Board might not exist yet in API, work locally
      }
    }
    loadBoard();
  }, [boardId]);

  // ─── Socket.IO ────────────────────────────────────────────────

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const socket = io(SOCKET_URL, {
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("board.join", { boardId });
    });

    socket.on("board.element.created", (data: { element: BoardElement }) => {
      setElements((prev) => {
        if (prev.some((e) => e.id === data.element.id)) return prev;
        return [...prev, data.element];
      });
    });

    socket.on(
      "board.element.updated",
      (data: { elementId: string; updates: Partial<BoardElement> }) => {
        setElements((prev) =>
          prev.map((el) =>
            el.id === data.elementId ? { ...el, ...data.updates } : el
          )
        );
      }
    );

    socket.on("board.element.deleted", (data: { elementId: string }) => {
      setElements((prev) => prev.filter((el) => el.id !== data.elementId));
    });

    socket.on(
      "board.cursor",
      (data: { userId: string; x: number; y: number; name: string }) => {
        if (data.userId === user?.id) return;
        setCursors((prev) => {
          const next = new Map(prev);
          const idx = Array.from(prev.keys()).indexOf(data.userId);
          const color = CURSOR_COLORS[(idx === -1 ? prev.size : idx) % CURSOR_COLORS.length];
          next.set(data.userId, {
            x: data.x,
            y: data.y,
            name: data.name,
            color,
          });
          return next;
        });
      }
    );

    return () => {
      socket.emit("board.leave", { boardId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId, user?.id]);

  // ─── Keyboard ─────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Space for panning
      if (e.code === "Space" && !editingId) {
        e.preventDefault();
        setSpaceHeld(true);
      }

      // Ctrl+Z undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !editingId) {
        e.preventDefault();
        handleUndo();
      }

      // Delete or Backspace to remove selected
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        !editingId
      ) {
        e.preventDefault();
        deleteElement(selectedId);
      }

      // Tool shortcuts (only when not editing text)
      if (!editingId && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const toolMap: Record<string, Tool> = {
          v: "select",
          s: "sticky",
          r: "rect",
          c: "circle",
          t: "text",
          l: "line",
          a: "arrow",
          d: "draw",
          e: "eraser",
        };
        const mappedTool = toolMap[e.key.toLowerCase()];
        if (mappedTool) {
          setTool(mappedTool);
          if (mappedTool !== "select") setSelectedId(null);
        }
      }

      // Escape
      if (e.key === "Escape") {
        setSelectedId(null);
        setEditingId(null);
        setTool("select");
        setCreateState(null);
        setLineCreateState(null);
        setIsDrawing(false);
        setTempElement(null);
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        setSpaceHeld(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedId, editingId, handleUndo, deleteElement]);

  // ─── Mouse handlers ───────────────────────────────────────────

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return screenToCanvas(e.clientX, e.clientY, pan, zoom, rect);
    },
    [pan, zoom]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Prevent default for middle mouse button
      if (e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        setPanStartOffset({ x: pan.x, y: pan.y });
        return;
      }

      // Space + click for panning
      if (spaceHeld && e.button === 0) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        setPanStartOffset({ x: pan.x, y: pan.y });
        return;
      }

      if (e.button !== 0) return;

      const point = getCanvasPoint(e);

      // If editing text, don't do anything else
      if (editingId) return;

      switch (tool) {
        case "select": {
          // Check if clicked on empty canvas space
          const clickedOnEmpty = (e.target as HTMLElement).tagName === "svg" ||
            (e.target as HTMLElement).classList.contains("canvas-bg");
          if (clickedOnEmpty) {
            setSelectedId(null);
          }
          break;
        }

        case "sticky": {
          const el: BoardElement = {
            id: generateId(),
            type: "sticky",
            x: point.x - 75,
            y: point.y - 50,
            width: Math.max(200, 120),
            height: Math.max(150, 80),
            rotation: 0,
            content: "",
            color: currentColor,
            fontSize: 14,
            properties: {},
            zIndex: elements.length,
          };
          addElement(el);
          setSelectedId(el.id);
          setEditingId(el.id);
          setTool("select");
          break;
        }

        case "rect":
        case "circle": {
          setCreateState({ startX: point.x, startY: point.y });
          setTempElement({
            id: generateId(),
            type: tool === "rect" ? "rect" : "circle",
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
            rotation: 0,
            content: "",
            color: currentColor,
            fontSize: 14,
            properties: {},
            zIndex: elements.length,
          });
          break;
        }

        case "text": {
          const el: BoardElement = {
            id: generateId(),
            type: "text",
            x: point.x,
            y: point.y,
            width: 200,
            height: 40,
            rotation: 0,
            content: "",
            color: currentColor === "#fef08a" ? "#ffffff" : currentColor,
            fontSize: 20,
            properties: {},
            zIndex: elements.length,
          };
          addElement(el);
          setSelectedId(el.id);
          setEditingId(el.id);
          setTool("select");
          break;
        }

        case "line":
        case "arrow": {
          if (!lineCreateState) {
            setLineCreateState({ startX: point.x, startY: point.y });
            setTempElement({
              id: generateId(),
              type: tool,
              x: point.x,
              y: point.y,
              width: 0,
              height: 0,
              rotation: 0,
              content: "",
              color: currentColor === "#fef08a" ? "#ffffff" : currentColor,
              fontSize: 14,
              properties: { x2: point.x, y2: point.y },
              zIndex: elements.length,
            });
          }
          break;
        }

        case "draw": {
          setIsDrawing(true);
          setDrawPoints([{ x: point.x, y: point.y }]);
          break;
        }

        case "eraser": {
          // Eraser works on click on element
          break;
        }
      }
    },
    [
      tool,
      spaceHeld,
      pan,
      zoom,
      getCanvasPoint,
      currentColor,
      elements.length,
      addElement,
      editingId,
      lineCreateState,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Send cursor position to socket (throttled)
      const now = Date.now();
      if (now - cursorThrottleRef.current > 50) {
        cursorThrottleRef.current = now;
        const point = getCanvasPoint(e);
        socketRef.current?.emit("board.cursor", {
          boardId,
          x: point.x,
          y: point.y,
          name: user?.name || "Anonymous",
          userId: user?.id,
        });
      }

      // Panning
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setPan({
          x: panStartOffset.x + dx,
          y: panStartOffset.y + dy,
        });
        return;
      }

      const point = getCanvasPoint(e);

      // Dragging element
      if (dragState) {
        const dx = point.x - dragState.startX;
        const dy = point.y - dragState.startY;
        setElements((prev) =>
          prev.map((el) =>
            el.id === dragState.id
              ? { ...el, x: dragState.elemX + dx, y: dragState.elemY + dy }
              : el
          )
        );
        return;
      }

      // Resizing element
      if (resizeState) {
        const dx = point.x - resizeState.startX;
        const dy = point.y - resizeState.startY;
        let newX = resizeState.origX;
        let newY = resizeState.origY;
        let newW = resizeState.origW;
        let newH = resizeState.origH;

        const handle = resizeState.handle;

        if (handle.includes("e")) newW = Math.max(30, resizeState.origW + dx);
        if (handle.includes("s")) newH = Math.max(30, resizeState.origH + dy);
        if (handle.includes("w")) {
          newW = Math.max(30, resizeState.origW - dx);
          newX = resizeState.origX + (resizeState.origW - newW);
        }
        if (handle.includes("n")) {
          newH = Math.max(30, resizeState.origH - dy);
          newY = resizeState.origY + (resizeState.origH - newH);
        }

        setElements((prev) =>
          prev.map((el) =>
            el.id === resizeState.id
              ? { ...el, x: newX, y: newY, width: newW, height: newH }
              : el
          )
        );
        return;
      }

      // Creating shape
      if (createState && tempElement) {
        const w = point.x - createState.startX;
        const h = point.y - createState.startY;
        const x = w >= 0 ? createState.startX : point.x;
        const y = h >= 0 ? createState.startY : point.y;
        setTempElement((prev) =>
          prev
            ? {
                ...prev,
                x,
                y,
                width: Math.abs(w),
                height: Math.abs(h),
              }
            : null
        );
        return;
      }

      // Creating line/arrow
      if (lineCreateState && tempElement) {
        setTempElement((prev) =>
          prev
            ? {
                ...prev,
                properties: { ...prev.properties, x2: point.x, y2: point.y },
                width: point.x - lineCreateState.startX,
                height: point.y - lineCreateState.startY,
              }
            : null
        );
        return;
      }

      // Drawing
      if (isDrawing) {
        setDrawPoints((prev) => [...prev, { x: point.x, y: point.y }]);
        return;
      }
    },
    [
      isPanning,
      panStart,
      panStartOffset,
      dragState,
      resizeState,
      createState,
      lineCreateState,
      tempElement,
      isDrawing,
      getCanvasPoint,
      boardId,
      user,
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // End panning
      if (isPanning) {
        setIsPanning(false);
        return;
      }

      // End dragging
      if (dragState) {
        const el = elements.find((e) => e.id === dragState.id);
        if (el) {
          updateElement(el.id, { x: el.x, y: el.y });
        }
        setDragState(null);
        return;
      }

      // End resize
      if (resizeState) {
        const el = elements.find((e) => e.id === resizeState.id);
        if (el) {
          updateElement(el.id, {
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
          });
        }
        setResizeState(null);
        return;
      }

      // End shape creation
      if (createState && tempElement) {
        if (tempElement.width > 5 && tempElement.height > 5) {
          addElement(tempElement);
          setSelectedId(tempElement.id);
        }
        setCreateState(null);
        setTempElement(null);
        setTool("select");
        return;
      }

      // End line/arrow creation
      if (lineCreateState && tempElement) {
        const dx = Math.abs(
          (tempElement.properties?.x2 ?? 0) - lineCreateState.startX
        );
        const dy = Math.abs(
          (tempElement.properties?.y2 ?? 0) - lineCreateState.startY
        );
        if (dx > 5 || dy > 5) {
          addElement(tempElement);
          setSelectedId(tempElement.id);
        }
        setLineCreateState(null);
        setTempElement(null);
        setTool("select");
        return;
      }

      // End drawing
      if (isDrawing && drawPoints.length > 1) {
        const pathData = drawPoints
          .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
          .join(" ");

        // Compute bounding box
        const xs = drawPoints.map((p) => p.x);
        const ys = drawPoints.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);

        const el: BoardElement = {
          id: generateId(),
          type: "draw",
          x: minX,
          y: minY,
          width: Math.max(...xs) - minX,
          height: Math.max(...ys) - minY,
          rotation: 0,
          content: "",
          color: currentColor === "#fef08a" ? "#ffffff" : currentColor,
          fontSize: 14,
          properties: { path: pathData },
          zIndex: elements.length,
        };
        addElement(el);
        setIsDrawing(false);
        setDrawPoints([]);
        return;
      }

      setIsDrawing(false);
      setDrawPoints([]);
    },
    [
      isPanning,
      dragState,
      resizeState,
      createState,
      lineCreateState,
      tempElement,
      isDrawing,
      drawPoints,
      currentColor,
      elements,
      addElement,
      updateElement,
    ]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);

      // Zoom toward cursor position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const scale = newZoom / zoom;
        setPan((prev) => ({
          x: cx - (cx - prev.x) * scale,
          y: cy - (cy - prev.y) * scale,
        }));
      }

      setZoom(newZoom);
    },
    [zoom]
  );

  // ─── Element interaction handlers ─────────────────────────────

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, el: BoardElement) => {
      e.stopPropagation();

      if (tool === "eraser") {
        deleteElement(el.id);
        return;
      }

      if (tool !== "select") return;

      const point = getCanvasPoint(e);

      pushUndo();
      setSelectedId(el.id);
      setDragState({
        id: el.id,
        startX: point.x,
        startY: point.y,
        elemX: el.x,
        elemY: el.y,
      });
    },
    [tool, getCanvasPoint, deleteElement, pushUndo]
  );

  const handleElementDoubleClick = useCallback(
    (e: React.MouseEvent, el: BoardElement) => {
      e.stopPropagation();
      if (el.type === "sticky" || el.type === "text") {
        setSelectedId(el.id);
        setEditingId(el.id);
      }
    },
    []
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, el: BoardElement, handle: string) => {
      e.stopPropagation();
      const point = getCanvasPoint(e);
      pushUndo();
      setResizeState({
        id: el.id,
        handle,
        startX: point.x,
        startY: point.y,
        origX: el.x,
        origY: el.y,
        origW: el.width,
        origH: el.height,
      });
    },
    [getCanvasPoint, pushUndo]
  );

  // ─── Text editing ─────────────────────────────────────────────

  const handleEditComplete = useCallback(
    (id: string, content: string) => {
      updateElement(id, { content });
      setEditingId(null);
    },
    [updateElement]
  );

  // ─── Zoom controls ────────────────────────────────────────────

  const zoomIn = useCallback(() => {
    setZoom((prev) => clamp(prev + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => clamp(prev - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const zoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ─── Save board ───────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    try {
      await api.put(`/api/projects/boards/${boardId}`, {
        title: boardTitle,
        elements,
      });
    } catch {
      // silent fail
    }
  }, [boardId, boardTitle, elements]);

  // ─── Render selection handles ─────────────────────────────────

  function renderSelectionHandles(el: BoardElement) {
    if (el.type === "line" || el.type === "arrow" || el.type === "draw")
      return null;

    const handleSize = 8 / zoom;
    const handles = [
      { id: "nw", cx: el.x, cy: el.y },
      { id: "ne", cx: el.x + el.width, cy: el.y },
      { id: "sw", cx: el.x, cy: el.y + el.height },
      { id: "se", cx: el.x + el.width, cy: el.y + el.height },
      { id: "n", cx: el.x + el.width / 2, cy: el.y },
      { id: "s", cx: el.x + el.width / 2, cy: el.y + el.height },
      { id: "w", cx: el.x, cy: el.y + el.height / 2 },
      { id: "e", cx: el.x + el.width, cy: el.y + el.height / 2 },
    ];

    return (
      <g>
        {/* Selection border */}
        <rect
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2 / zoom}
          strokeDasharray={`${4 / zoom}`}
          pointerEvents="none"
        />
        {/* Resize handles (circles) */}
        {handles.map((h) => (
          <circle
            key={h.id}
            cx={h.cx}
            cy={h.cy}
            r={handleSize / 2}
            fill="white"
            stroke="#6366f1"
            strokeWidth={1.5 / zoom}
            style={{
              cursor:
                h.id === "nw" || h.id === "se"
                  ? "nwse-resize"
                  : h.id === "ne" || h.id === "sw"
                  ? "nesw-resize"
                  : h.id === "n" || h.id === "s"
                  ? "ns-resize"
                  : "ew-resize",
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, el, h.id)}
          />
        ))}
      </g>
    );
  }

  // ─── Render individual element ────────────────────────────────

  function renderElement(el: BoardElement) {
    const isSelected = el.id === selectedId;
    const isEditing = el.id === editingId;

    switch (el.type) {
      case "sticky":
        return (
          <g
            key={el.id}
            onMouseDown={(e) => handleElementMouseDown(e, el)}
            onDoubleClick={(e) => handleElementDoubleClick(e, el)}
            style={{ cursor: tool === "eraser" ? "not-allowed" : tool === "select" ? "move" : "default" }}
          >
            <rect
              x={el.x}
              y={el.y}
              width={Math.max(el.width, 120)}
              height={Math.max(el.height, 80)}
              fill={el.color}
              rx={12}
              ry={12}
              filter="url(#shadow)"
            />
            {isEditing ? (
              <foreignObject
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                style={{ overflow: "visible" }}
              >
                <div
                  // @ts-ignore
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{ width: "100%", height: "100%" }}
                >
                  <textarea
                    ref={editInputRef}
                    defaultValue={el.content}
                    autoFocus
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={(e) => handleEditComplete(el.id, e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        handleEditComplete(
                          el.id,
                          (e.target as HTMLTextAreaElement).value
                        );
                      }
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      padding: "12px",
                      fontSize: `${el.fontSize}px`,
                      color: "#1a1a1a",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      fontFamily: "inherit",
                      lineHeight: 1.4,
                      pointerEvents: "auto",
                    }}
                  />
                </div>
              </foreignObject>
            ) : (
              <foreignObject
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                pointerEvents="none"
              >
                <div
                  // @ts-ignore
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    padding: "12px",
                    fontSize: `${el.fontSize}px`,
                    color: "#1a1a1a",
                    wordBreak: "break-word",
                    height: "100%",
                    overflow: "hidden",
                    lineHeight: 1.4,
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  {el.content || (isSelected ? "Double-click to type..." : "")}
                </div>
              </foreignObject>
            )}
            {isSelected && renderSelectionHandles(el)}
          </g>
        );

      case "rect":
        return (
          <g
            key={el.id}
            onMouseDown={(e) => handleElementMouseDown(e, el)}
            style={{ cursor: tool === "eraser" ? "not-allowed" : tool === "select" ? "move" : "default" }}
          >
            <rect
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              fill={el.color + "30"}
              stroke={el.color}
              strokeWidth={2}
              rx={4}
            />
            {isSelected && renderSelectionHandles(el)}
          </g>
        );

      case "circle":
        return (
          <g
            key={el.id}
            onMouseDown={(e) => handleElementMouseDown(e, el)}
            style={{ cursor: tool === "eraser" ? "not-allowed" : tool === "select" ? "move" : "default" }}
          >
            <ellipse
              cx={el.x + el.width / 2}
              cy={el.y + el.height / 2}
              rx={el.width / 2}
              ry={el.height / 2}
              fill={el.color + "30"}
              stroke={el.color}
              strokeWidth={2}
            />
            {isSelected && renderSelectionHandles(el)}
          </g>
        );

      case "text":
        return (
          <g
            key={el.id}
            onMouseDown={(e) => handleElementMouseDown(e, el)}
            onDoubleClick={(e) => handleElementDoubleClick(e, el)}
            style={{ cursor: tool === "eraser" ? "not-allowed" : tool === "select" ? "move" : "default" }}
          >
            {isEditing ? (
              <foreignObject
                x={el.x}
                y={el.y - el.fontSize * 0.3}
                width={Math.max(el.width, 200)}
                height={Math.max(el.height, el.fontSize * 2)}
                style={{ overflow: "visible" }}
              >
                <div
                  // @ts-ignore
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{ width: "100%", height: "100%" }}
                >
                  <textarea
                    ref={editInputRef}
                    defaultValue={el.content}
                    autoFocus
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={(e) => handleEditComplete(el.id, e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleEditComplete(
                          el.id,
                          (e.target as HTMLTextAreaElement).value
                        );
                      }
                      if (e.key === "Escape") {
                        handleEditComplete(
                          el.id,
                          (e.target as HTMLTextAreaElement).value
                        );
                      }
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      fontSize: `${el.fontSize}px`,
                      color: el.color,
                      background: "transparent",
                      border: "1px dashed #6366f1",
                      outline: "none",
                      resize: "none",
                      fontFamily: "inherit",
                      lineHeight: 1.3,
                      padding: "2px 4px",
                      pointerEvents: "auto",
                    }}
                  />
                </div>
              </foreignObject>
            ) : (
              <text
                x={el.x}
                y={el.y + el.fontSize}
                fontSize={el.fontSize}
                fill={el.color}
                style={{ userSelect: "none" }}
              >
                {el.content || "Text"}
              </text>
            )}
            {isSelected && !isEditing && renderSelectionHandles(el)}
          </g>
        );

      case "line":
      case "arrow": {
        const x2 = el.properties?.x2 ?? el.x + el.width;
        const y2 = el.properties?.y2 ?? el.y + el.height;
        return (
          <g
            key={el.id}
            onMouseDown={(e) => handleElementMouseDown(e, el)}
            style={{ cursor: tool === "eraser" ? "not-allowed" : tool === "select" ? "move" : "default" }}
          >
            {/* Invisible wider line for easier clicking */}
            <line
              x1={el.x}
              y1={el.y}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={12}
            />
            <line
              x1={el.x}
              y1={el.y}
              x2={x2}
              y2={y2}
              stroke={isSelected ? "#6366f1" : el.color}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {el.type === "arrow" && (
              <polygon
                points={arrowHeadPoints(el.x, el.y, x2, y2)}
                fill={isSelected ? "#6366f1" : el.color}
              />
            )}
            {isSelected && (
              <>
                <circle
                  cx={el.x}
                  cy={el.y}
                  r={5 / zoom}
                  fill="white"
                  stroke="#6366f1"
                  strokeWidth={1.5 / zoom}
                />
                <circle
                  cx={x2}
                  cy={y2}
                  r={5 / zoom}
                  fill="white"
                  stroke="#6366f1"
                  strokeWidth={1.5 / zoom}
                />
              </>
            )}
          </g>
        );
      }

      case "draw":
        return (
          <g
            key={el.id}
            onMouseDown={(e) => handleElementMouseDown(e, el)}
            style={{ cursor: tool === "eraser" ? "not-allowed" : tool === "select" ? "move" : "default" }}
          >
            {/* Invisible wider path for clicking */}
            <path
              d={el.properties?.path || ""}
              stroke="transparent"
              strokeWidth={12}
              fill="none"
            />
            <path
              d={el.properties?.path || ""}
              stroke={isSelected ? "#6366f1" : el.color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );

      default:
        return null;
    }
  }

  // ─── Render temp element (during creation) ────────────────────

  function renderTempElement() {
    if (!tempElement) return null;

    if (tempElement.type === "rect") {
      return (
        <rect
          x={tempElement.x}
          y={tempElement.y}
          width={tempElement.width}
          height={tempElement.height}
          fill={tempElement.color + "20"}
          stroke={tempElement.color}
          strokeWidth={2}
          strokeDasharray="5,5"
          rx={4}
          opacity={0.7}
        />
      );
    }

    if (tempElement.type === "circle") {
      return (
        <ellipse
          cx={tempElement.x + tempElement.width / 2}
          cy={tempElement.y + tempElement.height / 2}
          rx={tempElement.width / 2}
          ry={tempElement.height / 2}
          fill={tempElement.color + "20"}
          stroke={tempElement.color}
          strokeWidth={2}
          strokeDasharray="5,5"
          opacity={0.7}
        />
      );
    }

    if (tempElement.type === "line" || tempElement.type === "arrow") {
      const x2 = tempElement.properties?.x2 ?? tempElement.x;
      const y2 = tempElement.properties?.y2 ?? tempElement.y;
      return (
        <g>
          <line
            x1={tempElement.x}
            y1={tempElement.y}
            x2={x2}
            y2={y2}
            stroke={tempElement.color}
            strokeWidth={2}
            strokeDasharray="5,5"
            strokeLinecap="round"
          />
          {tempElement.type === "arrow" && (
            <polygon
              points={arrowHeadPoints(tempElement.x, tempElement.y, x2, y2)}
              fill={tempElement.color}
              opacity={0.6}
            />
          )}
        </g>
      );
    }

    return null;
  }

  // ─── Render active drawing path ───────────────────────────────

  function renderDrawingPath() {
    if (!isDrawing || drawPoints.length < 2) return null;
    const pathData = drawPoints
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
    return (
      <path
        d={pathData}
        stroke={currentColor === "#fef08a" ? "#ffffff" : currentColor}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    );
  }

  // ─── Render cursors ───────────────────────────────────────────

  function renderCursors() {
    const entries = Array.from(cursors.entries());
    return entries.map(([userId, cursor]) => (
      <g key={userId} transform={`translate(${cursor.x}, ${cursor.y})`}>
        <path
          d="M0,0 L0,16 L4.5,12.5 L9,18 L11,17 L6.5,11 L12,10 Z"
          fill={cursor.color}
          stroke="white"
          strokeWidth={1}
        />
        <rect
          x={14}
          y={10}
          width={cursor.name.length * 7 + 12}
          height={20}
          rx={4}
          fill={cursor.color}
        />
        <text
          x={20}
          y={24}
          fontSize={11}
          fill="white"
          fontWeight="500"
          style={{ userSelect: "none" }}
        >
          {cursor.name}
        </text>
      </g>
    ));
  }

  // ─── Render grid ──────────────────────────────────────────────

  function renderGrid() {
    const gridSize = 20 * zoom;
    return (
      <defs>
        <pattern
          id="grid"
          x={pan.x % gridSize}
          y={pan.y % gridSize}
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={1} cy={1} r={0.5} fill="currentColor" className="text-foreground/10" />
        </pattern>
      </defs>
    );
  }

  // ─── Toolbar items ────────────────────────────────────────────

  const toolbarGroups: {
    id: Tool;
    icon: React.ElementType;
    label: string;
    shortcut: string;
    dividerAfter?: boolean;
  }[][] = [
    [
      { id: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
    ],
    [
      { id: "sticky", icon: StickyNote, label: "Sticky Note", shortcut: "S" },
      { id: "rect", icon: Square, label: "Rectangle", shortcut: "R" },
      { id: "circle", icon: Circle, label: "Circle", shortcut: "C" },
      { id: "text", icon: Type, label: "Text", shortcut: "T" },
    ],
    [
      { id: "line", icon: Minus, label: "Line", shortcut: "L" },
      { id: "arrow", icon: ArrowRight, label: "Arrow", shortcut: "A" },
      { id: "draw", icon: Pencil, label: "Draw", shortcut: "D" },
    ],
    [
      { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
    ],
  ];

  // ─── Cursor style ─────────────────────────────────────────────

  const canvasCursor = useMemo(() => {
    if (isPanning) return "grabbing";
    if (spaceHeld) return "grab";
    if (tool === "select") return "default";
    if (tool === "eraser") return "not-allowed";
    if (tool === "draw") return "crosshair";
    if (tool === "sticky" || tool === "rect" || tool === "circle" || tool === "text") return "crosshair";
    if (tool === "line" || tool === "arrow") return "crosshair";
    return "crosshair";
  }, [tool, isPanning, spaceHeld]);

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex bg-zinc-900"
      style={{ overflow: "hidden" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-zinc-800/90 backdrop-blur border-b border-zinc-700/50 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={() => router.push("/boards")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-5 w-px bg-zinc-600" />
          <Input
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
            onBlur={handleSave}
            className="h-8 w-48 bg-transparent border-transparent text-white text-sm font-medium hover:border-zinc-600 focus:border-primary px-2"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Cursor avatars */}
          {cursors.size > 0 && (
            <div className="flex -space-x-2 mr-2">
              {Array.from(cursors.entries())
                .slice(0, 5)
                .map(([uid, c]) => (
                  <div
                    key={uid}
                    className="h-7 w-7 rounded-full border-2 border-zinc-800 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 text-xs"
            onClick={handleSave}
          >
            <Save className="h-3.5 w-3.5" />
            {t("common.save")}
          </Button>
          {boardCreatedBy && user?.id === boardCreatedBy && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-700"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-zinc-900 border-zinc-700">
                <DropdownMenuSeparator className="bg-zinc-700" />
                <DropdownMenuItem
                  className="text-red-400 focus:text-red-400 focus:bg-red-900/20 gap-2 cursor-pointer"
                  onClick={async () => {
                    if (!confirm(t("projects.delete_confirm"))) return;
                    try {
                      await api.delete(`/api/projects/boards/${boardId}`);
                      router.push("/boards");
                    } catch {}
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Left toolbar */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
        <div className="bg-zinc-800/90 backdrop-blur rounded-xl border border-zinc-700/50 p-1.5 flex flex-col gap-0.5 shadow-xl">
          {toolbarGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="h-px bg-zinc-700 my-1" />}
              {group.map((item) => {
                const Icon = item.icon;
                const active = tool === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTool(item.id);
                      if (item.id !== "select") setSelectedId(null);
                    }}
                    className={`
                      h-9 w-9 rounded-lg flex items-center justify-center transition-all
                      ${
                        active
                          ? "bg-primary text-white shadow-lg shadow-primary/25"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-700"
                      }
                    `}
                    title={`${item.label} (${item.shortcut})`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          ))}

          <div className="h-px bg-zinc-700 my-1" />

          {/* Color picker toggle */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all relative"
            title="Color"
          >
            <Palette className="h-4 w-4" />
            <div
              className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-zinc-600"
              style={{ backgroundColor: currentColor }}
            />
          </button>
        </div>

        {/* Color picker dropdown */}
        {showColorPicker && (
          <div className="absolute left-full ml-2 top-0 bg-zinc-800/90 backdrop-blur rounded-xl border border-zinc-700/50 p-3 shadow-xl">
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setCurrentColor(color);
                    setShowColorPicker(false);
                    // Apply to selected element
                    if (selectedId) {
                      pushUndo();
                      updateElement(selectedId, { color });
                    }
                  }}
                  className={`
                    h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110
                    ${currentColor === color ? "border-primary scale-110" : "border-zinc-600"}
                  `}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-zinc-800/90 backdrop-blur rounded-xl border border-zinc-700/50 px-3 py-2 flex items-center gap-2 shadow-xl">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={zoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            onClick={zoomReset}
            className="text-xs text-zinc-300 font-mono min-w-[52px] text-center px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={zoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="h-5 w-px bg-zinc-600 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>

          {selectedId && selectedElement && (selectedElement.type === "sticky" || selectedElement.type === "text") && (
            <>
              <div className="h-5 w-px bg-zinc-600 mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
                onClick={() => {
                  const newSize = Math.max(8, (selectedElement.fontSize || 14) - 2);
                  updateElement(selectedId, { fontSize: newSize });
                }}
                title="Decrease font size"
              >
                <span className="text-xs font-bold">A-</span>
              </Button>
              <span className="text-xs text-zinc-300 font-mono min-w-[28px] text-center">{selectedElement.fontSize || 14}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
                onClick={() => {
                  const newSize = Math.min(72, (selectedElement.fontSize || 14) + 2);
                  updateElement(selectedId, { fontSize: newSize });
                }}
                title="Increase font size"
              >
                <span className="text-xs font-bold">A+</span>
              </Button>
            </>
          )}

          {selectedId && (
            <>
              <div className="h-5 w-px bg-zinc-600 mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                onClick={() => {
                  if (selectedId) deleteElement(selectedId);
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 mt-12"
        style={{
          cursor: canvasCursor,
          overflow: "hidden",
          touchAction: "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="canvas-bg"
          style={{
            background: "#1a1a2e",
          }}
        >
          {renderGrid()}

          {/* Grid background - in screen space, using pattern that accounts for pan/zoom */}
          <rect
            width="100%"
            height="100%"
            fill="url(#grid)"
            className="canvas-bg"
          />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

            {/* Render elements sorted by zIndex */}
            {[...elements]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((el) => renderElement(el))}

            {/* Temp element during creation */}
            {renderTempElement()}

            {/* Active drawing path */}
            {renderDrawingPath()}

            {/* Remote cursors */}
            {renderCursors()}
          </g>

          {/* SVG filters */}
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow
                dx="0"
                dy="3"
                stdDeviation="4"
                floodColor="#000"
                floodOpacity="0.25"
              />
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  );
}
