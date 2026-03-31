"use client";

import * as React from "react";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

export type ToastVariant = "default" | "destructive" | "success";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: React.ReactNode;
};

type ToastAction =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "UPDATE_TOAST"; toast: Partial<Toast> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId: string }
  | { type: "REMOVE_TOAST"; toastId: string };

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

function reducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "ADD_TOAST":
      return [action.toast, ...state].slice(0, TOAST_LIMIT);

    case "UPDATE_TOAST":
      return state.map((t) =>
        t.id === action.toast.id ? { ...t, ...action.toast } : t
      );

    case "DISMISS_TOAST":
      return state.filter((t) => t.id !== action.toastId);

    case "REMOVE_TOAST":
      return state.filter((t) => t.id !== action.toastId);

    default:
      return state;
  }
}

// Global listeners pattern for cross-component toast triggering
const listeners: Array<(state: Toast[]) => void> = [];
let memoryState: Toast[] = [];

function dispatch(action: ToastAction) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: React.ReactNode;
}

function toast(options: ToastOptions) {
  const id = genId();
  const duration = options.duration ?? TOAST_REMOVE_DELAY;

  dispatch({
    type: "ADD_TOAST",
    toast: { ...options, id },
  });

  // Auto-dismiss
  const dismissTimeout = setTimeout(() => {
    dispatch({ type: "DISMISS_TOAST", toastId: id });
  }, duration);

  return {
    id,
    dismiss: () => {
      clearTimeout(dismissTimeout);
      dispatch({ type: "DISMISS_TOAST", toastId: id });
    },
    update: (props: Partial<ToastOptions>) =>
      dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } }),
  };
}

function useToast() {
  const [state, setState] = React.useState<Toast[]>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toasts: state,
    toast,
    dismiss: (toastId: string) =>
      dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
