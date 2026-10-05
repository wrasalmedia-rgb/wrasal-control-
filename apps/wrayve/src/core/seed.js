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
