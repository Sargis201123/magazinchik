// Гардероб человечков (art/wardrobe.py): головные уборы, одежда поверх рубашки, вещи в руках,
// на лице и на спине. У каждой вещи три картинки: спереди, со спины (_b) и сбоку (_s).
// Шляпы, вещи и то, что на спине, нарисованы на холсте побольше (40×44, человечек сдвинут
// на 8 точек вправо и вниз) — поэтому в игре их слой стоит чуть выше.

export const HATS = [
  'feathers', 'shako', 'flatcap', 'headscarf', 'headphones', 'headband', 'nursecap', 'toque', 'policecap',
  'firehelmet', 'hardhat', 'bucket', 'sunhat', 'straw', 'bandana', 'mohawk', 'beret', 'sailor', 'cowboy',
  'bikehelmet', 'bow', 'ushanka', 'furhat', 'crown', 'tricorn', 'clownwig', 'knighthelmet', 'antennae',
  'tophat', 'viking', 'tiara', 'ninjahood',
] as const;
export const OUTFITS = [
  'samba', 'band', 'cardigan', 'hoodie', 'tracksuit', 'suit', 'labcoat', 'chefcoat', 'police', 'firecoat',
  'leather', 'fishvest', 'hawaii', 'telnyashka', 'dress', 'furcoat', 'gown', 'piratecoat', 'clownsuit',
  'armor', 'spacesuit', 'vikingfur', 'herosuit', 'tutu', 'ninja',
] as const;
export const PROPS = [
  'maracas', 'trumpet', 'drum', 'flag', 'balloon', 'cane', 'stringbag', 'briefcase', 'rod', 'camera',
  'basket', 'newspaper', 'bouquet', 'books', 'coffee', 'palette', 'flask', 'bottle', 'scepter', 'parrot',
  'sword', 'raygun', 'wand',
] as const;
export const FACES = [
  'beard', 'mustache', 'sunglasses', 'eyepatch', 'clownnose', 'heromask',
] as const;
export const BACKS = [
  'fan', 'guitar', 'cube', 'yogamat', 'mantle', 'cape', 'shield',
] as const;

export type HatId = (typeof HATS)[number];
export type OutfitId = (typeof OUTFITS)[number];
export type PropId = (typeof PROPS)[number];
export type FaceId = (typeof FACES)[number];
export type BackId = (typeof BACKS)[number];

/** На сколько точек мира выше ставить большой слой (40×44): (44 − 36) / 2 пикселя спрайта при ART = 2. */
export const BIG_LAYER_DY = -2;

const VIEWS = ['', '_b', '_s'];

/** Имена всех картинок гардероба — для загрузки. */
export const WARDROBE_TEXTURES: string[] = (
  [
    ['hat', HATS],
    ['outfit', OUTFITS],
    ['prop', PROPS],
    ['face', FACES],
    ['back', BACKS],
  ] as [string, readonly string[]][]
).flatMap(([kind, names]) => names.flatMap((name) => VIEWS.map((v) => `w_${kind}_${name}${v}`)));
