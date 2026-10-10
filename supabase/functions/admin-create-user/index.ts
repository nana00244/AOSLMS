import { z } from 'zod';
import { authenticate, json } from '../_shared/http.ts';

const inputSchema = z.object({
  action: z.enum(['create', 'update', 'deactivate']).default('create'),
  id: z.string().uuid().optional(),
  email: z.string().email().max(254).optional(),
  password: z.string().min(12).max(128).optional(),
  fullName: z.string().trim().min(1).max(200).optional(),
  role: z.enum(['Administrator', 'Teacher', 'Student', 'Accountant']).optional(),
  active: z.boolean().default(true),
  studentId: z.string().max(150).nullable().optional(),
  classes: z.array(z.string().min(1).max(150)).max(100).default([]),
  classAllowedSubjects: z.record(z.string(), z.array(z.string())).default({}),
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({});
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { client, profile } = await authenticate(request);
    if (profile.role !== 'Administrator')
      return json({ error: 'Administrator access required' }, 403);
    const input = inputSchema.parse(await request.json());
    if (
      input.id === profile.id &&
      (input.action === 'deactivate' || !input.active || input.role !== 'Administrator')
    )
      return json({ error: 'You cannot deactivate or demote your own administrator account' }, 400);
    if (input.action === 'deactivate') {
      if (!input.id) return json({ error: 'Choose an account' }, 400);
      const { error } = await client.from('profiles').update({ active: false }).eq('id', input.id);
      if (error) throw error;
      const { error: banError } = await client.auth.admin.updateUserById(input.id, {
        ban_duration: '876000h',
      });
      if (banError) throw banError;
      await client
        .from('audit_log')
        .insert({
          actor_id: profile.id,
          action: 'Account deactivated',
          entity_id: input.id,
          entity: 'profiles',
        });
      return json({ success: true });
    }
    if (!input.email || !input.fullName || !input.role)
      return json({ error: 'Email, name and role are required' }, 400);
    const { data: workspace, error: workspaceError } = await client
      .from('school_workspace')
      .select('document')
      .eq('id', true)
      .single();
    if (workspaceError) throw workspaceError;
    if (input.classes.some((c) => !workspace.document.classes.includes(c)))
      return json({ error: 'Choose existing classes' }, 400);
    if (
      input.role === 'Student' &&
      (!input.studentId || !workspace.document.students.some((s: any) => s.id === input.studentId))
    )
      return json({ error: 'Link the student account to an existing student record' }, 400);
    const values = {
      full_name: input.fullName,
      email: input.email.toLowerCase(),
      role: input.role,
      active: input.active,
      student_id: input.role === 'Student' ? input.studentId : null,
      classes: input.role === 'Teacher' ? input.classes : [],
      class_allowed_subjects: input.classAllowedSubjects,
    };
    let id = input.id;
    if (input.action === 'create') {
      if (!input.password)
        return json({ error: 'A password of at least 12 characters is required' }, 400);
      const { data, error } = await client.auth.admin.createUser({
        email: values.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      });
      if (error || !data.user) throw error || new Error('Could not create account');
      id = data.user.id;
      const { error: profileError } = await client.from('profiles').update(values).eq('id', id);
      if (profileError) {
        await client.auth.admin.deleteUser(id);
        throw profileError;
      }
    } else {
      if (!id) return json({ error: 'Choose an account' }, 400);
      const { data: original, error: originalError } = await client
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (originalError) throw originalError;
      const { error: authError } = await client.auth.admin.updateUserById(id, {
        email: values.email,
        email_confirm: true,
        ...(input.password ? { password: input.password } : {}),
        ban_duration: input.active ? 'none' : '876000h',
        user_metadata: { full_name: input.fullName },
      });
      if (authError) throw authError;
      const { error: profileError } = await client.from('profiles').update(values).eq('id', id);
      if (profileError) {
        await client.auth.admin.updateUserById(id, {
          email: original.email,
          email_confirm: true,
          ban_duration: original.active ? 'none' : '876000h',
        });
        throw profileError;
      }
    }
    const { error: auditError } = await client
      .from('audit_log')
      .insert({
        actor_id: profile.id,
        action: input.action === 'create' ? 'Login account created' : 'Login account updated',
        entity: 'profiles',
        entity_id: id,
      });
    if (auditError) console.error('Account audit failed', auditError.code);
    return json({ user: { id, email: values.email } }, input.action === 'create' ? 201 : 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : (error as any)?.message || 'Account request failed';
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400);
  }
});
