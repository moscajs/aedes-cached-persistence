import type { Client } from 'aedes';
import type {
  AedesPersistenceSubscription,
  CallbackError,
} from 'aedes-persistence';
import { expectType } from 'tsd';
import aedesCachedPersistence, { AedesCachedPersistence, Packet } from '.';

expectType<AedesCachedPersistence>(aedesCachedPersistence());

function listener([]: any[], done: () => void) {}

expectType<AedesCachedPersistence>(
  aedesCachedPersistence().once('ready', listener)
);

expectType<void>(aedesCachedPersistence()._onMessage({} as Packet, () => {}));

expectType<void>(
  aedesCachedPersistence()._waitFor(
    {} as Client,
    'sub_topic',
    (error?: Error | null, client?: Client) => {}
  )
);

expectType<void>(
  aedesCachedPersistence()._addedSubscriptions(
    {} as Client,
    [] as AedesPersistenceSubscription[],
    (error?: Error | null, client?: Client) => {}
  )
);

expectType<void>(
  aedesCachedPersistence()._removedSubscriptions(
    {} as Client,
    [] as AedesPersistenceSubscription[],
    (error?: Error | null, client?: Client) => {}
  )
);

expectType<void>(aedesCachedPersistence()._setup());

expectType<void>(
  aedesCachedPersistence()._addedSubscriptions(
    {} as Client,
    [] as AedesPersistenceSubscription[],
    (err: CallbackError) => {}
  )
);

expectType<void>(
  aedesCachedPersistence()._removedSubscriptions(
    {} as Client,
    [] as AedesPersistenceSubscription[],
    (err: CallbackError) => {}
  )
);

expectType<void>(
  aedesCachedPersistence().subscriptionsByTopic(
    'pattern',
    (error: CallbackError, subs: AedesPersistenceSubscription[]) => {}
  )
);

expectType<void>(
  aedesCachedPersistence().cleanSubscriptions(
    {} as Client,
    (error: CallbackError, client: Client) => {}
  )
);

expectType<void>(
  aedesCachedPersistence().outgoingEnqueueCombi(
    [{ clientId: '' }],
    {} as Packet,
    (error: CallbackError) => {}
  )
);

expectType<void>(aedesCachedPersistence().destroy());

expectType<void>(aedesCachedPersistence().destroy(() => {}));
