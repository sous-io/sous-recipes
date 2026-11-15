{% comment %}
This file is compiled by sous into `CLAUDE.md` and `AGENTS.md` at the project root. Never edit
the compiled copies: edit the memories this file includes, then run `sous build`.

This project's own memories are the markdown files in the folders beside this file, such as
`imported/` (what `sous init` imported) and `conventions/`. Add a file to one of them, or a
new folder, and the next build includes it. Keep at least one file there: an include that
matches nothing stops the build.
{% endcomment -%}
@*/**/*.md

{% comment %}This line pulls in the memories of every recipe this project subscribes to.{% endcomment %}
@#memories/**/*.md
