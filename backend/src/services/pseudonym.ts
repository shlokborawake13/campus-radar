import crypto from 'crypto';

const ADJECTIVES = [
  'Silent', 'Clever', 'Mystic', 'Brave', 'Curious', 'Swift', 'Gentle', 'Wandering',
  'Golden', 'Cosmic', 'Shadow', 'Midnight', 'Emerald', 'Electric', 'Rustic', 'Noble',
  'Radiant', 'Vibrant', 'Chill', 'Secret', 'Hidden', 'Phantom', 'Quiet', 'Keen'
];

const NOUNS = [
  'Owl', 'Falcon', 'Panther', 'Sparrow', 'Badger', 'Otter', 'Fox', 'Hawk',
  'Wolf', 'Lynx', 'Raven', 'Dolphin', 'Stag', 'Panda', 'Tiger', 'Eagle',
  'Comet', 'Voyager', 'Phoenix', 'Scholar', 'Wanderer', 'Pioneer', 'Echo', 'Horizon'
];

export function generateAnonymousPseudonym(): string {
  const adjIndex = crypto.randomInt(0, ADJECTIVES.length);
  const nounIndex = crypto.randomInt(0, NOUNS.length);
  const tagNum = crypto.randomInt(100, 999);

  return `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]} #${tagNum}`;
}
