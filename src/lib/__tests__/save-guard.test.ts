const { createSaveGuard } = require("../../../public/save-guard.js");

describe("save guard", () => {
	test("blocks automatic saves until the restore settles", () => {
		const guard = createSaveGuard();
		expect(guard.canAutoSave("state")).toBe(false);
		expect(guard.canAutoSave("srm")).toBe(false);
	});

	test("a successful load or a confirmed empty server unblocks that kind only", () => {
		const guard = createSaveGuard();
		guard.markRestore("state", "loaded");
		guard.markRestore("srm", "none");
		expect(guard.canAutoSave("state")).toBe(true);
		expect(guard.canAutoSave("srm")).toBe(true);

		const other = createSaveGuard();
		other.markRestore("srm", "none");
		expect(other.canAutoSave("state")).toBe(false);
	});

	test("a failed restore keeps automatic saves blocked so the server copy survives", () => {
		const guard = createSaveGuard();
		guard.markRestore("state", "error");
		expect(guard.canAutoSave("state")).toBe(false);
	});
});
