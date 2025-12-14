import { SessionData } from "./session.types";

export interface BaseMessage {
  action: string;
}

export interface GetCurrentSessionMessage extends BaseMessage {
  action: "getCurrentSession";
  domain: string;
  tabId: number;
}

export interface SwitchSessionMessage extends BaseMessage {
  action: "switchSession";
  sessionData: SessionData;
  tabId: number;
}

export interface ClearSessionMessage extends BaseMessage {
  action: "clearSession";
  domain: string;
  tabId: number;
}

// GetCurrentDomainMessage removed - now using URL parameters

export interface ClearSessionsMessage extends BaseMessage {
  action: "clearSessions";
  clearOption: "current" | "all";
  domain: string;
}

export interface ExportSessionsMessage extends BaseMessage {
  action: "exportSessions";
  exportOption: "current" | "all";
  domain: string;
}


export interface ImportSessionsMessage extends BaseMessage {
  action: "importSessions";
  data: string;
}


export interface ImportSessionsNewMessage extends BaseMessage {
  action: "IMPORT_SESSIONS_NEW";
  data: {
    sessions: SessionData[];
    mode: string;
  };
}


export type MessageType = 
  | GetCurrentSessionMessage 
  | SwitchSessionMessage 
  | ClearSessionMessage
  // GetCurrentDomainMessage removed - now using URL parameters
  | ClearSessionsMessage
  | ExportSessionsMessage
  | ImportSessionsMessage
  | ImportSessionsNewMessage;

export interface MessageResponse<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

export type SendResponseType<T = unknown> = (response: MessageResponse<T>) => void;
