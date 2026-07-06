/**
 * ONB-08 — resumable onboarding: the step survives a process restart
 * (simulated via jest.resetModules; the kv backing store persists like disk).
 *
 * Modules are loaded with require() after resetModules: Jest runs CJS, and a
 * runtime dynamic import() would need --experimental-vm-modules.
 */
type StateModule = typeof import('../onboarding/state');

function loadState(): StateModule {
   
  return require('../onboarding/state') as StateModule;
}

describe('ONB-08 onboarding resumes at the persisted step', () => {
  it('restores the step from storage after a restart', async () => {
    const first = loadState();
    await first.setStep('calibrate');

    jest.resetModules(); // "kill the app" — module caches gone, disk remains

    const second = loadState();
    await expect(second.getStep()).resolves.toBe('calibrate');
    expect(second.routeForStep('calibrate')).toBe('/onboarding/calibrate');
  });

  it('defaults to welcome on first launch', async () => {
    jest.resetModules();
    const state = loadState();
    await expect(state.getStep()).resolves.toBe('welcome');
  });
});
