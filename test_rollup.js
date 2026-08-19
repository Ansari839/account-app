const map = new Map();
map.set('ap', -100); // Level 2
map.set('cl', 0);    // Level 1

const allAccounts = [
  { id: 'cl', level: 1, parentId: null },
  { id: 'ap', level: 2, parentId: 'cl' }
];

const sortedForRollup = [...allAccounts].sort((a, b) => (b.level || 0) - (a.level || 0));
for (const acc of sortedForRollup) {
    if (acc.parentId) {
        const childBalance = map.get(acc.id) || 0;
        const parentBalance = map.get(acc.parentId) || 0;
        map.set(acc.parentId, parentBalance + childBalance);
    }
}
console.log(map.get('cl')); // Should be -100
