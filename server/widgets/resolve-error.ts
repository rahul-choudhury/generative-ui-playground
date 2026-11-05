/**
 * A failure the user should see in the widget (and the model should be told
 * about), e.g. "Couldn't find a place called 'Atlantis'". Anything else a
 * resolver throws is treated as an unexpected bug and gets a generic message.
 */
export class ResolveError extends Error {
  override name = "ResolveError"
}
