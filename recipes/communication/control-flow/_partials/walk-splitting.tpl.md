## When an Item Splits

A walk goes through a body of material one item at a time, started by the user with `/walk`. An
item that turns out to hold several questions is split into sub-items, whether the agent notices it
or the user asks with `/walk-deeper`.

- There is only ever ONE walk. A split MUST NOT start a second walk, and MUST NOT pause the current
  walk to run another.
- Insert the sub-items into the current walk, right after the item they came from, in the order
  they should be answered.
- Name them as sub-items of it: `3-a`, `3-b` under item 3, or `0300-Q1`, `0300-Q2` under item
  `0300`. Any sensible suffix works, and a sub-item MAY be split again, to any depth (`3-a-1`).
  Depth only changes the name.
- Count every item, parent and sub-item alike, as one flat list: (position/total). The counter only
  needs to be roughly right; it shows how far the walk has come and how much remains.
- The sub-items answer the parent: the parent gets no answer of its own, and the recap at the end of
  the walk lists the sub-items' answers under it.
- The sub-items follow the walk's action policy. A split never changes the policy and is never
  permission to act: in a discussion-only walk, take no state-changing action; under "act after
  each item", act on the parent once its last sub-item is answered; under "act after each item and
  sub-item", act on each sub-item as it is answered.
- In one message, say what was split, into how many sub-items, and the new total; show the
  remaining list with the sub-items in place; then present the first sub-item in the usual item
  format.
