### Before merging confirm and check off each item:

- [ ] Are the CI checks successful?
- [ ] Do the proposed changes work successfully in staging?
- [ ] Has the code been reviewed with a go-ahead from another contributor?

**If the PR has data migrations**

- [ ] Do all of the new data migrations post-date all of the currently applied data migrations?

### Merge the code

- [ ] Merge the code

### After merging confirm and check off each item:

- [ ] Are the expected changes present in production?
- [ ] Did the CI checks pass in production?

_If any of these items failed after merging, post a message in Slack and resolve or escalate as needed._
