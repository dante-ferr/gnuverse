import * as migration_20261014_224435 from './20261014_224435';
import * as migration_20261014_224856_storage from './20261014_224856_storage';

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
];
