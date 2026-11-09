import * as migration_20261014_224435 from './20261014_224435';
import * as migration_20261014_224856_storage from './20261014_224856_storage';
import * as migration_20261105_000000_shared_identity from './20261105_000000_shared_identity';

export const migrations = [
  {
    up: migration_20261014_224435.up,
    down: migration_20261014_224435.down,
    name: '20261014_224435',
  },
  {
    up: migration_20261014_224856_storage.up,
    down: migration_20261014_224856_storage.down,
    name: '20261014_224856_storage'
  },
  {
    up: migration_20261105_000000_shared_identity.up,
    down: migration_20261105_000000_shared_identity.down,
    name: '20261105_000000_shared_identity',
  },
];
