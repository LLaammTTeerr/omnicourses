---
"@omnicourse/backend": minor
"@omnicourse/frontend": minor
---

The planner moves closer to its prototype: while a course is dragged or lifted, each term says before the drop what the rule engine would report there and what its load would be (new `POST /plans/{id}/issues`, which saves nothing); the page scrolls near its edges and tiles glide to their new place; Undo (Ctrl+Z), What-if (a copy to try changes on) and plan tabs sit above a status strip with the expected graduation term and each group's credits; the course tray is a grid of tiles with group filters and elective slots; terms already taken and the courses in progress now are shown; each term row puts its load and labelled meter beside its tiles; tiles show their group, a grade from an earlier attempt and a "!" on a violation; and the issues panel collapses, gives each issue a short title, and counts the groups still short instead of listing them.
