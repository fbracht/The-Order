export const PRESETS = [
  // Board Games (Original Dev Set)
  [
    "Arcs",
    "Root",
    "Oath",
    "Pax Pamir",
    "John Company",
    "Molly House"
  ],
  // The Beatles Studio Albums
  [
    "Please Please Me",
    "With The Beatles",
    "A Hard Day's Night",
    "Beatles for Sale",
    "Help!",
    "Rubber Soul",
    "Revolver",
    "Sgt. Pepper's Lonely Hearts Club Band",
    "Magical Mystery Tour",
    "The Beatles (White Album)",
    "Yellow Submarine",
    "Abbey Road",
    "Let It Be"
  ],
  // Quentin Tarantino Feature Films
  [
    "Reservoir Dogs",
    "Pulp Fiction",
    "Jackie Brown",
    "Kill Bill: Vol. 1",
    "Kill Bill: Vol. 2",
    "Death Proof",
    "Inglourious Basterds",
    "Django Unchained",
    "The Hateful Eight",
    "Once Upon a Time in Hollywood"
  ],
  // 17 Ice Cream Flavors
  [
    "Vanilla",
    "Chocolate",
    "Strawberry",
    "Mint Chocolate Chip",
    "Cookie Dough",
    "Cookies and Cream",
    "Rocky Road",
    "Butter Pecan",
    "Coffee",
    "Pistachio",
    "Neapolitan",
    "Birthday Cake",
    "French Vanilla",
    "Chocolate Chip",
    "Salted Caramel",
    "Moose Tracks",
    "Praline Pecan"
  ]
];

export const getRandomPreset = (currentText: string = ''): string[] => {
  // Filter out the current text if it matches a preset exactly, so we get a new one
  const available = PRESETS.filter(p => p.join('\n') !== currentText.trim());
  
  // If current text matches the only preset (unlikely given multiple presets) or something else, 
  // fall back to random selection from all.
  const pool = available.length > 0 ? available : PRESETS;
  
  return pool[Math.floor(Math.random() * pool.length)];
};