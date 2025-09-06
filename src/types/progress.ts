export type Phase =
  | "init"
  | "upload"
  | "processing"
  | "generate"
  | "stream"
  | "done"
  | "error";

export type BaseEvent = {
  phase: Phase;
  progress: number; // 0..100, non-decreasing
  message?: string;
  segmentIndex?: number;
  segmentTotal?: number;
};

export type ProgressEvent = BaseEvent & {
  kind: "progress";
};

export type DeltaEvent = BaseEvent & {
  kind: "delta";
  delta: string;
};

export type DoneEvent = BaseEvent & {
  kind: "done";
  text: string;
  tokens?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
};

export type ErrorEvent = {
  kind: "error";
  phase: "error";
  progress: number;
  error: { code: string; message: string };
};

export type StreamEvent = ProgressEvent | DeltaEvent | DoneEvent | ErrorEvent;

