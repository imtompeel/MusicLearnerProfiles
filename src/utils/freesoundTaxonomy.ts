// Helpers for Freesound tag building and Broad Sound Taxonomy mapping

export interface TermTags {
  includeTags: string[];
  excludeTags: string[];
}

export const buildTagsForTerm = (term: string): TermTags => {
  const t = term.toLowerCase();
  const includeTags: string[] = [];
  const excludeTags: string[] = ['loop', 'remix', 'synth'];
  includeTags.push('one-shot');

  // Instruments
  if (t.includes('flute')) { includeTags.push('flute'); excludeTags.push('harmonica', 'mouth', 'melodica'); }
  if (t.includes('piano')) { includeTags.push('piano'); excludeTags.push('pad'); }
  if (t.includes('guitar')) { includeTags.push('guitar'); excludeTags.push('bass'); }
  if (t.includes('bass')) { includeTags.push('bass'); excludeTags.push('guitar'); }
  if (t.includes('drum') || t.includes('percussion') || t.includes('snare') || t.includes('kick')) {
    includeTags.push('drum', 'percussion', 'hit');
    excludeTags.push('melody', 'tone', 'sine','underwater');
  }
  if (t.includes('harmonica')) { includeTags.push('harmonica'); excludeTags.push('flute'); }
  if (t.includes('tone') || t.includes('sine') || t.includes('beep')) { includeTags.push('tone'); excludeTags.push('drum', 'percussion'); }

  // Animals
  if (t.includes('cat')) { includeTags.push('cat', 'meow', 'animal'); excludeTags.push('music'); }
  if (t.includes('dog')) { includeTags.push('dog', 'bark', 'animal'); excludeTags.push('music'); }
  if (t.includes('bird')) { includeTags.push('bird', 'chirp', 'tweet', 'animal'); excludeTags.push('music'); }
  if (t.includes('cow')) { includeTags.push('cow', 'moo', 'animal', 'farm'); excludeTags.push('music','creepy','cave','echo','reverb','fx','sfx'); }

  // Nature / environment
  if (t.includes('rain')) {
    includeTags.push('rain', 'water', 'nature', 'storm');
    excludeTags.push('music');
  }
  if (t.includes('wind')) { includeTags.push('wind', 'blow', 'nature'); excludeTags.push('music','rain'); }
  if (t.includes('ocean') || t.includes('sea') || t.includes('waves')) { includeTags.push('ocean', 'wave', 'sea', 'water', 'nature'); }
  if (t.includes('forest')) { includeTags.push('forest', 'nature', 'birds'); }
  if (t.includes('thunder')) { includeTags.push('thunder', 'storm', 'nature'); }

  // Vehicles / urban
  if (t.includes('car')) { includeTags.push('car', 'engine', 'vehicle'); excludeTags.push('music'); }
  if (t.includes('train')) { includeTags.push('train', 'vehicle'); }
  if (t.includes('siren')) { includeTags.push('siren', 'alarm'); }
  if (t.includes('traffic')) { includeTags.push('traffic', 'city'); }

  // Human sounds
  if (t.includes('clap') || t.includes('applause')) { includeTags.push('clap', 'applause', 'hands'); excludeTags.push('music'); }
  if (t.includes('footstep')) { includeTags.push('footstep', 'walk'); }
  if (t.includes('voice') || t.includes('speech')) { includeTags.push('voice', 'speech'); excludeTags.push('song', 'singing'); }

  return { includeTags, excludeTags };
};

export const buildExtraAntiTerms = (term: string): string[] => {
  const t = term.toLowerCase();
  const anti: string[] = [];
  if (t.includes('cow')) anti.push('cave', 'creepy', 'echo', 'reverb');
  if (t.includes('animal')) anti.push('music', 'melody');
  return anti;
};

export const getTaxonomyForTerm = (term: string): { categoryFilter?: string; subcategoryFilter?: string } => {
  const t = term.toLowerCase();
  // Field recordings
  if (t.includes('rain')) return { categoryFilter: 'Field recordings', subcategoryFilter: 'Rain' };
  if (t.includes('wind')) return { categoryFilter: 'Field recordings', subcategoryFilter: 'Wind' };
  if (t.includes('ocean') || t.includes('sea') || t.includes('waves')) return { categoryFilter: 'Field recordings', subcategoryFilter: 'Water' };
  if (t.includes('forest')) return { categoryFilter: 'Field recordings', subcategoryFilter: 'Forest' };
  if (t.includes('dog') || t.includes('cat') || t.includes('bird') || t.includes('cow') || t.includes('animal')) return { categoryFilter: 'Field recordings', subcategoryFilter: 'Animals' };
  if (t.includes('car') || t.includes('train') || t.includes('vehicle') || t.includes('traffic')) return { categoryFilter: 'Field recordings', subcategoryFilter: 'Vehicles' };
  if (t.includes('siren')) return { categoryFilter: 'Field recordings', subcategoryFilter: 'Urban' };
  // Instrument samples
  if (t.includes('piano')) return { categoryFilter: 'Instrument samples', subcategoryFilter: 'Piano / Keyboard instruments' };
  if (t.includes('guitar')) return { categoryFilter: 'Instrument samples', subcategoryFilter: 'Guitar' };
  if (t.includes('bass')) return { categoryFilter: 'Instrument samples', subcategoryFilter: 'Bass' };
  if (t.includes('drum') || t.includes('percussion') || t.includes('snare') || t.includes('kick')) return { categoryFilter: 'Instrument samples', subcategoryFilter: 'Percussion instruments' };
  if (t.includes('flute') || t.includes('harmonica')) return { categoryFilter: 'Instrument samples', subcategoryFilter: 'Wind instruments' };
  // Sound effects / Human / UI
  if (t.includes('clap') || t.includes('applause') || t.includes('footstep') || t.includes('voice') || t.includes('speech')) return { categoryFilter: 'Sound effects', subcategoryFilter: 'Human sounds' };
  if (t.includes('tone') || t.includes('beep') || t.includes('sine')) return { categoryFilter: 'Sound effects', subcategoryFilter: 'Alarms / UI' };
  return {};
};

// Build anti-terms per search term to exclude misleading results
export const getAntiTermsForTerm = (term: string): string[] => {
  const t = term.toLowerCase();
  const anti: string[] = [];

  // Instruments
  if (t.includes('flute')) anti.push('harmonica', 'melodica', 'mouth');
  if (t.includes('harmonica')) anti.push('flute');
  if (t.includes('piano')) anti.push('pad', 'synth');
  if (t.includes('guitar')) anti.push('bass');
  if (t.includes('bass')) anti.push('guitar', 'synth');
  if (t.includes('drum') || t.includes('percussion') || t.includes('snare') || t.includes('kick')) anti.push('tone', 'sine', 'melody', 'underwater');

  // Animals / field recordings
  if (t.includes('animal')) anti.push('music', 'melody');
  if (t.includes('dog') || t.includes('cat') || t.includes('bird') || t.includes('cow')) anti.push('music');
  if (t.includes('cow')) anti.push('cave', 'creepy', 'echo', 'reverb', 'fx', 'sfx');

  // Natural elements
  if (t.includes('wind')) anti.push('rain', 'chime', 'chimes', 'bell', 'bells');

  // UI tones
  if (t.includes('tone') || t.includes('beep') || t.includes('sine')) anti.push('drum', 'percussion', 'loop');

  // House appliances / objects
  if (t.includes('vacuum') || t.includes('hoover') || (t.includes('cleaner') && t.includes('vacuum'))) {
    anti.push('chime', 'chimes', 'bell', 'bells', 'wind', 'whistle', 'flute', 'ambient', 'music');
  }

  // Food: sizzle/fry should not be musical instruments or percussive effects
  if (t.includes('sizzle') || t.includes('frying')) {
    anti.push('vibra', 'soda');
  }

  // Clocks
  if (t.includes('clock') || t.includes('ticking') || t.includes('tick') || t.includes('tock')) {
    anti.push('music', 'melody', 'drum');
  }

  return anti;
};

// Positive include tags for specific terms where text search benefits from biasing
export const getIncludeTagsForTerm = (term: string): string[] => {
  const t = term.toLowerCase();
  const include: string[] = [];

  // Food sounds
  if (t.includes('popcorn')) include.push('popcorn', 'pop');
  if (t.includes('bubble')) include.push('bubble', 'bubbling', 'boil', 'boiling');
  if (t.includes('sizzle') || t.includes('fry')) include.push('sizzle',);
  if (t.includes('crunch') || t.includes('bite')) include.push('crunch', 'crunchy', 'bite', 'biting', 'apple', 'chips', 'crisps');

  return Array.from(new Set(include));
};


// Return ordered taxonomy candidates to try. This allows preferring certain
// subcategories (e.g., Sound effects → Animals before Field recordings → Animals)
export const getTaxonomyCandidatesForTerm = (term: string): Array<{ categoryFilter?: string; subcategoryFilter?: string }> => {
  const t = term.toLowerCase();
  const candidates: Array<{ categoryFilter?: string; subcategoryFilter?: string }> = [];

  // Animals: prefer Sound effects first, then Field recordings
  if (t.includes('dog') || t.includes('cat') || t.includes('bird') || t.includes('cow') || t.includes('animal')) {
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Animals' });
    candidates.push({ categoryFilter: 'Field recordings', subcategoryFilter: 'Animals' });
    return candidates;
  }

  // Human sounds
  if (t.includes('clap') || t.includes('applause') || t.includes('footstep') || t.includes('footsteps') || t.includes('walk')) {
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Human sounds' });
    candidates.push({ categoryFilter: 'Speech', subcategoryFilter: 'Conversation / Crowd' });
    return candidates;
  }
  if (t.includes('voice') || t.includes('speech') || t.includes('talk')) {
    candidates.push({ categoryFilter: 'Speech', subcategoryFilter: 'Solo speech' });
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Human sounds' });
    return candidates;
  }

  // Instruments
  if (t.includes('piano') || t.includes('keyboard')) {
    candidates.push({ categoryFilter: 'Instrument samples', subcategoryFilter: 'Piano / Keyboard instruments' });
    candidates.push({ categoryFilter: 'Music', subcategoryFilter: 'Solo instrument' });
    return candidates;
  }
  if (t.includes('guitar')) {
    candidates.push({ categoryFilter: 'Instrument samples', subcategoryFilter: 'Guitar' });
    candidates.push({ categoryFilter: 'Music', subcategoryFilter: 'Solo instrument' });
    return candidates;
  }
  if (t.includes('bass')) {
    candidates.push({ categoryFilter: 'Instrument samples', subcategoryFilter: 'Bass' });
    candidates.push({ categoryFilter: 'Music', subcategoryFilter: 'Solo instrument' });
    return candidates;
  }
  if (t.includes('drum') || t.includes('percussion') || t.includes('snare') || t.includes('kick')) {
    candidates.push({ categoryFilter: 'Instrument samples', subcategoryFilter: 'Percussion instruments' });
    candidates.push({ categoryFilter: 'Music', subcategoryFilter: 'Solo percussion' });
    return candidates;
  }
  if (t.includes('flute') || t.includes('harmonica')) {
    candidates.push({ categoryFilter: 'Instrument samples', subcategoryFilter: 'Wind instruments' });
    candidates.push({ categoryFilter: 'Music', subcategoryFilter: 'Solo instrument' });
    return candidates;
  }

  // UI / tones
  if (t.includes('tone') || t.includes('beep') || t.includes('sine')) {
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Alarms / UI' });
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Electronic / Design' });
    return candidates;
  }

  // Food sounds (popcorn, bubble, sizzle, crunch): use Sound effects (no subcategory to keep broad)
  if (t.includes('popcorn') || t.includes('bubble') || t.includes('sizzle') || t.includes('fry') || t.includes('crunch') || t.includes('bite')) {
    candidates.push({ categoryFilter: 'Sound effects' });
    return candidates;
  }

  // Natural elements
  if (t.includes('rain')) {
    candidates.push({ categoryFilter: 'Field recordings', subcategoryFilter: 'Rain' });
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Natural elements and explosions' });
    return candidates;
  }
  if (t.includes('wind')) {
    candidates.push({ categoryFilter: 'Field recordings', subcategoryFilter: 'Wind' });
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Natural elements and explosions' });
    return candidates;
  }
  if (t.includes('ocean') || t.includes('sea') || t.includes('waves') || t.includes('water')) {
    candidates.push({ categoryFilter: 'Field recordings', subcategoryFilter: 'Water' });
    candidates.push({ categoryFilter: 'Soundscapes', subcategoryFilter: 'Nature' });
    return candidates;
  }
  if (t.includes('forest') || t.includes('woodland')) {
    candidates.push({ categoryFilter: 'Field recordings', subcategoryFilter: 'Forest' });
    candidates.push({ categoryFilter: 'Soundscapes', subcategoryFilter: 'Nature' });
    return candidates;
  }

  // Vehicles / Urban
  if (t.includes('car') || t.includes('train') || t.includes('vehicle') || t.includes('traffic')) {
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Vehicles' });
    candidates.push({ categoryFilter: 'Field recordings', subcategoryFilter: 'Vehicles' });
    candidates.push({ categoryFilter: 'Soundscapes', subcategoryFilter: 'Urban' });
    return candidates;
  }
  // Clocks / ticking
  if (t.includes('clock') || t.includes('tick') || t.includes('tock') || t.includes('ticking')) {
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Other mechanisms, engines, machines' });
    return candidates;
  }
  // House appliances / objects (e.g., vacuum cleaner)
  if (t.includes('vacuum') || t.includes('hoover') || (t.includes('cleaner') && t.includes('vacuum'))) {
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Objects/House appliances' });
    // Fallbacks: machines and indoors ambience
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Other mechanisms, engines, machines' });
    candidates.push({ categoryFilter: 'Soundscapes', subcategoryFilter: 'Indoors' });
    return candidates;
  }
  if (t.includes('siren') || t.includes('alarm')) {
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Alarms / UI' });
    candidates.push({ categoryFilter: 'Sound effects', subcategoryFilter: 'Objects/House appliances' });
    candidates.push({ categoryFilter: 'Field recordings', subcategoryFilter: 'Urban' });
    return candidates;
  } else {
    const single = getTaxonomyForTerm(term);
    if (single.categoryFilter || single.subcategoryFilter) {
      candidates.push(single);
    }
  }

  return candidates;
};

