/**
 * Seed the canonical demonstration identity from §16/§17.
 * Runs only when the event log is empty — it never rewrites existing history.
 */
export function seedIfEmpty(service) {
  if (service.log.all().length > 0) return false;

  const identity = service.createIdentity({
    id: 'WRAY-001',
    canonical_name: 'Wray',
    actor: 'wrasal.control',
  });

  const snapshot = service.createSnapshot({
    identity_id: identity.id,
    face_reference: 'wrasal-ref://wray/face/v0.1',
    voice_reference: 'wrasal-ref://wray/voice/v0.1',
    appearance_profile: 'Dark structured silhouette. Minimal styling. Low-key key light, deep falloff, no fill.',
    performance_profile: 'Still, controlled, direct eye contact. Low vocal register. No performative gesture.',
    canonical_notes: 'First canonical capture. Establishes the reference against which all later snapshots are compared.',
    actor: 'wrasal.control',
  });

  service.createPolicy({
    identity_snapshot_id: snapshot.id,
    permissions: {
      commercial_allowed: true,
      political_allowed: false,
      sexualized_allowed: false,
      deceptive_context_allowed: false,
      identity_alteration_allowed: false,
      public_distribution_allowed: false,
      approval_required: true,
    },
    notes: 'Default WRASAL likeness authority. Contextual permissions, not a single consent flag.',
    actor: 'wrasal.control',
  });

  service.createScene({
    identity_snapshot_id: snapshot.id,
    title: 'WRAY / BLACK ROOM TEST',
    description: 'Cinematic identity test. Establishes the execution loop end to end.',
    environment: 'Minimal black studio',
    wardrobe: 'Black structured jacket',
    performance_direction: 'Still, controlled, direct eye contact',
    camera_direction: '85mm portrait, subtle dolly-in, cinematic naturalism',
    dialogue: 'This is not an avatar. This is an identity under authority.',
    voice_direction: 'Low register. Unhurried. No rhetorical lift at the end of the line.',
    duration_seconds: 12,
    intended_context: { commercial: true },
    actor: 'wrasal.control',
  });

  return true;
}

/**
 * Bootstrap ProviderBindings asserted by the environment.
 *
 * Every binding created here is DECLARED. None is VERIFIED. An operator
 * putting an identifier in an env var is an assertion that a provider
 * represents this snapshot — it is not evidence that the provider agrees.
 * Promotion to VERIFIED requires an observed provider response.
 *
 * Provider-neutral by construction: this reads whatever the config layer
 * declares and never names a provider itself.
 */
export function bootstrapProviderBindings(service, declarations = []) {
  const snapshots = service.listIdentities()
    .map((identity) => service.activeSnapshotFor(identity.id))
    .filter(Boolean);
  if (snapshots.length === 0) return [];

  const target = snapshots[0];
  const created = [];
  for (const declaration of declarations) {
    const existing = service.listProviderBindings().find(
      (binding) => binding.identity_snapshot_id === target.id
        && binding.provider === declaration.provider
        && binding.provider_object_type === declaration.provider_object_type
        && binding.provider_subject_id === declaration.provider_subject_id,
    );
    if (existing) continue;
    created.push(service.declareProviderBinding({
      identity_snapshot_id: target.id,
      provider: declaration.provider,
      provider_object_type: declaration.provider_object_type,
      provider_subject_id: declaration.provider_subject_id,
      label: declaration.label ?? null,
      actor: 'wrasal.control',
    }));
  }
  return created;
}
