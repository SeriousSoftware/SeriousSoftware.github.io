//============================================================================
// Note representation
//============================================================================

/**
 Number of MIDI notes
 */
var NUM_NOTES = 128;

/**
 Number of notes per octave
 */
var NOTES_PER_OCTAVE = 12;

/**
 Number of cents per octave
 */
var CENTS_PER_OCTAVE = 1200;

/**
 Frequency of the A4 note
 */
var A4_NOTE_FREQ = 440;

/**
 Note number of the A4 note
 */
var A4_NOTE_NO = 69;

/**
 Note number of the C4 note
 */
var C4_NOTE_NO = 71;

/**
 Mapping from note names to pitch classes
 */
var NOTE_NAME_PC = {
    'C': 0,
    'C#': 1,
    'D': 2,
    'D#': 3,
    'E': 4,
    'F': 5,
    'F#': 6,
    'G': 7,
    'G#': 8,
    'A': 9,
    'A#': 10,
    'B': 11
};

/**
 Mapping from pitch classes to note names
 */
var PC_NOTE_NAME = {
    0: 'C',
    1: 'C#',
    2: 'D',
    3: 'D#',
    4: 'E',
    5: 'F',
    6: 'F#',
    7: 'G',
    8: 'G#',
    9: 'A',
    10: 'A#',
    11: 'B'
};

/**
 @class Represents note values.

 Midi note numbers go from 0 to 127.

 A4 is tuned to 440Hz, and corresponds to midi note 69.

 F(n) = 440 * (2^(1/12))^(n - 69)
 = 440 * 2 ^ ((n-69)/12)
 */
function Note(val) {
    // If we got a note name, convert it to a note number
    if (typeof val === 'string')
        val = Note.nameToNo(val);

    assert(
        typeof val === 'number',
        'invalid note number'
    );

    if (Note.notesByNo[val] !== undefined)
        return Note.notesByNo[val];

    // Create a note object
    var note = Object.create(Note.prototype);
    note.noteNo = val;

    // Store the note object in the note table
    Note.notesByNo[val] = note;

    return note;
}

/**
 Array of note numbers to note objects
 */
Note.notesByNo = [];

/**
 Get the note number for a note name
 */
Note.nameToNo = function (name) {
    // Use a regular expression to parse the name
    var matches = name.match(/([A-G]#?)([0-9])/i);

    assert(
        matches !== null,
        'invalid note name: "' + name + '"'
    );

    var namePart = matches[1];
    var numPart = matches[2];

    var pc = NOTE_NAME_PC[namePart];

    assert(
        typeof pc === 'number',
        'invalid note name: ' + namePart
    );

    var octNo = parseInt(numPart);

    // Compute the note number
    var noteNo = (octNo + 1) * NOTES_PER_OCTAVE + pc;

    assert(
        noteNo >= 0 || noteNo < NUM_NOTES,
        'note parsing failed'
    );

    return noteNo;
};

/**
 Sorting function for note objects
 */
Note.sortFn = function (n1, n2) {
    return n1.noteNo - n2.noteNo;
};

/**
 Get the pitch class
 */
Note.prototype.getPC = function () {
    return this.noteNo % NOTES_PER_OCTAVE;
};

/**
 Get the octave number
 */
Note.prototype.getOctNo = function () {
    return Math.floor(this.noteNo / NOTES_PER_OCTAVE) - 1;
};

/**
 Get the name for a note
 */
Note.prototype.getName = function () {
    // Compute the octave number of the note
    var octNo = this.getOctNo();

    // Get the pitch class for this note
    var pc = this.getPC();

    var name = PC_NOTE_NAME[pc];

    // Add the octave number to the note name
    name += String(octNo);

    return name;
};

/**
 The string representation of a note is its name
 */
Note.prototype.toString = Note.prototype.getName;

/**
 Get the frequency for a note
 @param offset detuning offset in cents
 */
Note.prototype.getFreq = function (offset) {
    if (offset === undefined)
        offset = 0;

    // F(n) = 440 * 2 ^ ((n-69)/12)
    var noteExp = (this.noteNo - A4_NOTE_NO) / NOTES_PER_OCTAVE;

    // b = a * 2 ^ (o / 1200)
    var offsetExp = offset / CENTS_PER_OCTAVE;

    // Compute the note frequency
    return A4_NOTE_FREQ * Math.pow(
            2,
            noteExp + offsetExp
        );
};

/**
 Offset a note by a number of semitones
 */
Note.prototype.offset = function (numSemis) {
    var offNo = this.noteNo + numSemis;

    assert(
        offNo >= 0 && offNo < NUM_NOTES,
        'invalid note number after offset'
    );

    return new Note(offNo);
};

/**
 Shift a note to higher or lower octaves
 */
Note.prototype.shift = function (numOcts) {
    return this.offset(numOcts * NOTES_PER_OCTAVE);
};

//============================================================================
// Scale and chord generation
//============================================================================

/**
 Semitone intervals for different scales
 */
var scaleIntervs = {

    // Major scale
    'major': [2, 2, 1, 2, 2, 2],

    // Natural minor scale
    'natural minor': [2, 1, 2, 2, 1, 2],

    // Major pentatonic scale
    'major pentatonic': [2, 2, 3, 2],

    // Minor pentatonic scale
    'minor pentatonic': [3, 2, 2, 3],

    // Blues scale
    'blues': [3, 2, 1, 1, 3],

    // Chromatic scale
    'chromatic': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
};

/**
 Generate the notes of a scale based on a root note
 */
function genScale(rootNote, scale, numOctaves) {
    if (!(rootNote instanceof Note))
        rootNote = new Note(rootNote);

    if (numOctaves === undefined)
        numOctaves = 1;

    // Get the intervals for this type of chord
    var intervs = scaleIntervs[scale];

    assert(
        intervs instanceof Array,
        'invalid scale name: ' + scale
    );

    // List of generated notes
    var notes = [];

    // For each octave
    for (var octNo = 0; octNo < numOctaves; ++octNo) {
        var octRoot = rootNote.shift(octNo);

        // Add the root note to the scale
        notes.push(octRoot);

        // Add the scale notes
        for (var i = 0; i < intervs.length; ++i) {
            var prevNote = notes[notes.length - 1];

            var interv = intervs[i];

            notes.push(prevNote.offset(interv));
        }
    }

    // Add the note closing the last octave
    notes.push(rootNote.shift(numOctaves));

    return notes;
}

