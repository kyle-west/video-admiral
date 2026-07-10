// Builds a small fake media library under ./dev-media by copying a sample mp4
// into a folder structure that mirrors a real library. Pass a path to a sample
// mp4 as the first arg, or place one at ./scripts/sample.mp4.
const fs = require('fs')
const path = require('path')

const sample = path.resolve(process.argv[2] || path.join(__dirname, 'sample.mp4'))
if (!fs.existsSync(sample)) {
  console.error(`No sample video found at ${sample}. Pass a path to a small .mp4 as the first argument.`)
  process.exit(1)
}

const root = path.resolve(__dirname, '..', 'dev-media')

const structure = {
  'Adventure Time/Season 01': ['01 Slumber Party Panic', '02 Trouble in Lumpy Space', '03 Prisoners of Love', '05 The Enchiridion', '08 Business Time'],
  'Adventure Time/Season 02': ['01 Loyalty to the King', '02 Blood Under the Skin', '03 It Came from the Nightosphere'],
  'Adventure Time/Season 03': ['01 Conquest of Cuteness', '02 Morituri Te Salutamus'],
  'Avatar the Last Airbender/Book 1 - Water': ['01 The Boy in the Iceberg', '02 The Avatar Returns', '03 The Southern Air Temple', '04 The Warriors of Kyoshi'],
  'Avatar the Last Airbender/Book 2 - Earth': ['01 The Avatar State', '02 The Cave of Two Lovers'],
  'Avatar the Last Airbender/Book 3 - Fire': ['01 The Awakening', '02 The Headband'],
  'Batman': ['Batman Begins', 'The Dark Knight', 'The Dark Knight Rises'],
  'Lord of The Rings/The Fellowship of the Ring': ['Disc 1', 'Disc 2'],
  'Lord of The Rings/The Two Towers': ['Disc 1', 'Disc 2'],
  '': ["Howl's Moving Castle", 'Inception', 'The Muppets Take Manhattan', 'Superman Returns'],
}

for (const [folder, titles] of Object.entries(structure)) {
  const dir = path.join(root, folder)
  fs.mkdirSync(dir, { recursive: true })
  for (const title of titles) {
    const dest = path.join(dir, `${title}.m4v`)
    if (!fs.existsSync(dest)) fs.copyFileSync(sample, dest)
  }
}

console.log(`Dev media library created at ${root}`)
