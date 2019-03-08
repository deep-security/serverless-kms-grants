workflow "main" {
  on = "push"
  resolves = "lint"
}

action "lint" {
  uses = "docker://node:lts"
  runs = "npm run ci:lint"
}
