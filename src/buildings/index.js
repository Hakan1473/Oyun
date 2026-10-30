// Tüm binalar buradan kaydedilir. Yeni bir bina eklemek için:
//   1) src/buildings/ altına bir dosya açın, defineBuilding({...}) ile tanımlayın
//   2) Aşağıya tek satır import ekleyin. Hepsi bu — mağaza, kayıt ve köylüler onu tanır.

import './palace.js';
import './house.js';
import './resources.js';
import './decor.js';

export * from './registry.js';
