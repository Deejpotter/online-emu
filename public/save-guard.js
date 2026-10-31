/**
 * Save guard for the emulator page.
 *
 * Automatic saves (window blur, tab hidden, page close, the periodic timer)
 * must never upload before the server copy has been restored. Otherwise a
 * freshly booted game, or an empty memory card, overwrites the real save.
 *
 * A kind ("state" or "srm") is "settled" once its restore either succeeded or
 * the server confirmed there is nothing to restore (404). A network or server
 * error leaves it unsettled, so automatic saves stay blocked for the session.
 * Manual saves and in-game memory card writes are not gated.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory();
	} else {
		root.SaveGuard = factory();
	}
})(typeof self !== "undefined" ? self : this, function () {
	function createSaveGuard() {
		const settled = { state: false, srm: false };

		return {
			/** Record a restore outcome: "loaded", "none" (404) or "error". */
			markRestore(kind, outcome) {
				if (outcome === "loaded" || outcome === "none") settled[kind] = true;
			},
			/** Whether an automatic save of this kind may run. */
			canAutoSave(kind) {
				return settled[kind] === true;
			},
		};
	}

	return { createSaveGuard };
});
