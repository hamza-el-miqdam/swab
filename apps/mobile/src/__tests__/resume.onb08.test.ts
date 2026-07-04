/**
 * ONB-08 — resumable onboarding: the step survives a process restart
 * (simulated via jest.resetModules; the kv backing store persists like disk).
 */
describe('ONB-08 onboarding resumes at the persisted step', () => {
  it('restores the step from storage after a restart', async () => {
    const first = await import('../onboarding/state');
    await first.setStep('calibrate');

    jest.resetModules(); // "kill the app" — module caches gone, disk remains

    const second = await import('../onboarding/state');
    await expect(second.getStep()).resolves.toBe('calibrate');
    expect(second.routeForStep('calibrate')).toBe('/onboarding/calibrate');
  });

  it('defaults to welcome on first launch', async () => {
    jest.resetModules();
    const state = await import('../onboarding/state');
    await expect(state.getStep()).resolves.toBe('welcome');
  });
});
