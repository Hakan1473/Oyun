// Tüm yapılar buradan kaydedilir. Yeni bir yapı eklemek için:
//   1) src/buildings/ altına bir dosya açın, defineBuilding({...}) ile tanımlayın
//   2) Aşağıya tek satır import ekleyin. Mağaza, kayıt, karakterler ve gece varlıkları onu tanır.

import './cabin.js';
import './camp.js';
import './nature.js';

export * from './registry.js';
