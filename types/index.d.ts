import type { Client } from 'aedes';
import type {
  AedesPersistence,
  AedesPersistenceSubscription,
  CallbackError,
  Packet,
} from 'aedes-persistence';
import type { EventEmitter } from 'events';
import type { Readable } from 'stream';

export type { Packet } from 'aedes-persistence';

type ExcludedAedesPersistenceFunctions =
  | 'storeRetained'
  | 'countOffline'
  | 'outgoingEnqueue'
  | 'outgoingUpdate'
  | 'addSubscriptions'
  | 'removeSubscriptions'
  | 'outgoingClearMessageId'
  | 'incomingStorePacket'
  | 'incomingGetPacket'
  | 'incomingDelPacket'
  | 'putWill'
  | 'delWill'
  | 'createRetainedStream'
  | 'outgoingStream'
  | 'subscriptionsByClient'
  | 'getWill'
  | 'streamWill'
  | 'getClientList'
  | 'destroy';

export class AedesCachedPersistence
  extends EventEmitter
  implements Omit<AedesPersistence, ExcludedAedesPersistenceFunctions> {
  ready: boolean;
  destroyed: boolean;
  _parallel: any;
  _trie: any; // Qlobber
  _waiting: Record<string, (error?: Error | null, client?: Client) => void>;

  once(event: 'ready', listener: (...args: any[]) => void): this;

  _onMessage(packet: Packet, cb: () => void): void;

  constructor(options?: { captureRejections?: boolean });

  // action is prefixed by sub_ or unsub_
  _waitFor: (
    client: Client,
    action: string,
    cb: (error?: Error | null, client?: Client) => void
  ) => void;

  _addedSubscriptions: (
    client: Client,
    subs: AedesPersistenceSubscription[],
    cb: (error?: Error | null, client?: Client) => void
  ) => void;

  _removedSubscriptions: (
    client: Client,
    subs: AedesPersistenceSubscription[],
    cb: (error?: Error | null, client?: Client) => void
  ) => void;

  _setup: () => void;

  createRetainedStreamCombi: (patterns: string[]) => Readable;

  subscriptionsByTopic: (
    pattern: string,
    cb: (error: CallbackError, subs: AedesPersistenceSubscription[]) => void
  ) => void;

  cleanSubscriptions: (
    client: Client,
    cb: (error: CallbackError, client: Client) => void
  ) => void;

  outgoingEnqueueCombi: (
    sub: { clientId: string }[],
    packet: Packet,
    cb: (error: CallbackError) => void
  ) => void;

  destroy: (cb?: (error: CallbackError) => void) => void;
}

export default function aedesCachedPersistence(): AedesCachedPersistence;
