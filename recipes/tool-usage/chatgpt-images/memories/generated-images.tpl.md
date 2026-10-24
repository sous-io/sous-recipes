{% assign imagesDir = sousHome | append: "/generated-images" %}{% getFiles storedImages root=imagesDir include="[0-9]*/*.md" %}
## Generated Images

Every image generated with `/create-image` or `/create-image-spread` is kept in `{{ imagesDir }}`,
in one folder per day, beside a markdown file of the same name. That file's frontmatter records the
prompt, the model, the user's verdict and comments, why the image was made and where it was used.
The archive held {{ storedImages | size }} images when these instructions were last built. Every
generation costs the user money, so before generating a new image the agent SHOULD check whether a
stored one already fits. The agent performing any image generation MUST load the
`about-chatgpt-images` skill first.
