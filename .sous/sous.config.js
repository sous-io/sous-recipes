// The primary sous config for sous-recipes.
//
// sous finds this file by walking up from the directory it was run in until it meets a
// `.sous/` directory holding a config. Everything a build needs starts here. Drop-in
// layers under `.sous/conf.d/` merge over it, and the layers sous writes for itself go
// into that directory, never into this file. Written by `sous init` (sous 1.0.18);
// it is yours now.

export const config = {
  // Shown in command output. Any string.
  name: "sous-recipes",

  // What to compile. Each target reads one source and writes it somewhere. ${sousDir} and
  // ${projectRoot} are set by sous, so nothing here depends on where the project is checked out.
  // A line holding only `@path/to/file.md` in a source pulls that file in, and a `.tpl.` in a
  // file name turns Liquid templating on for it.
  //
  // Everything this config writes is build output, gitignored by `sous init`: edit the sources
  // under `.sous/`, never the compiled copies, and run `sous build` after cloning.
  compilation: {
    targets: [
      // The agent instructions: `.sous/memories/instructions.tpl.md` compiled into
      // both files agents read at the project root.
      {
        entryPoint: "${sousDir}/memories/instructions.tpl.md",
        outputs: [
          { destinationFile: "${projectRoot}/CLAUDE.md" },
          { destinationFile: "${projectRoot}/AGENTS.md" },
        ],
      },
    ],
  },

  // The standard set of recipes. `omakase/house` has no files of its own: subscribing to it
  // subscribes this project to every recipe its manifest lists. This is this repository's own
  // choice; `sous repo init` does not subscribe new repositories to it.
  subscriptions: {
    "omakase/house": { range: "^1" },
  },

  // Every project subscribes to the `core` namespace on its own. The skills the recipes it
  // subscribes to publish reach your agent's directories through the targets that plugins add;
  // `sous recipe list` shows what is available, and `sous subscription add` subscribes.
};
