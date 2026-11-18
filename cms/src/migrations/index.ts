import * as migration_20261014_224435 from './20261014_224435';
import * as migration_20261014_224856_storage from './20261014_224856_storage';
import * as migration_20261105_000000_shared_identity from './20261105_000000_shared_identity';
import * as migration_20261115_155653_editorial_workflow from './20261115_155653_editorial_workflow';
import * as migration_20261116_162100_article_hashtags_published_at from './20261116_162100_article_hashtags_published_at';
import * as migration_20261118_120000_username_login from './20261118_120000_username_login';

export const migrations = [
  {
    up: migration_20261014_224435.up,
    down: migration_20261014_224435.down,
    name: '20261014_224435',
  },
  {
    up: migration_20261014_224856_storage.up,
    down: migration_20261014_224856_storage.down,
    name: '20261014_224856_storage',
  },
  {
    up: migration_20261105_000000_shared_identity.up,
    down: migration_20261105_000000_shared_identity.down,
    name: '20261105_000000_shared_identity',
  },
  {
    up: migration_20261115_155653_editorial_workflow.up,
    down: migration_20261115_155653_editorial_workflow.down,
    name: '20261115_155653_editorial_workflow',
  },
  {
    up: migration_20261116_162100_article_hashtags_published_at.up,
    down: migration_20261116_162100_article_hashtags_published_at.down,
    name: '20261116_162100_article_hashtags_published_at',
  },
  {
    up: migration_20261118_120000_username_login.up,
    down: migration_20261118_120000_username_login.down,
    name: '20261118_120000_username_login',
  },
];
