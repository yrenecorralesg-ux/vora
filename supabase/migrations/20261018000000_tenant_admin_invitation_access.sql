BEGIN;
ALTER TABLE public.tenant_invitations ADD COLUMN email_status text NOT NULL DEFAULT 'not_sent'
 CHECK (email_status IN ('not_sent','accepted','failed','not_configured'));
ALTER TABLE public.tenant_invitations ADD COLUMN email_sent_at timestamptz;
-- Supabase token_hash is a bearer credential, not an inert digest. Members must
-- never be able to read another invitee's token through the Supabase Data API.
DROP POLICY IF EXISTS ti_select_admin_or_member ON public.tenant_invitations;
CREATE POLICY ti_select_admin_only ON public.tenant_invitations FOR SELECT TO authenticated USING(public.vora_is_super_admin());
GRANT SELECT ON public.tenant_invitations TO authenticated;

CREATE FUNCTION public.vora_prepare_admin_invitation(p_tenant uuid,p_email text,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i tenant_invitations; cap integer; used integer;
BEGIN
 IF NOT public.vora_is_super_admin() THEN RAISE EXCEPTION 'Permisos insuficientes'; END IF;
 PERFORM 1 FROM tenants WHERE id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Empresa inexistente'; END IF;
 IF length(p_email)>254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(p_hash)<32 THEN RAISE EXCEPTION 'Invitación inválida'; END IF;
 SELECT * INTO i FROM tenant_invitations WHERE tenant_id=p_tenant AND email=lower(trim(p_email)) FOR UPDATE;
 IF i.email_sent_at>now()-interval '60 seconds' THEN RAISE EXCEPTION 'Espera un minuto para reenviar'; END IF;
 SELECT (p.limits->>'max_users')::integer INTO cap FROM tenants t JOIN plans p ON p.id=t.plan_id WHERE t.id=p_tenant;
 SELECT count(*) INTO used FROM tenant_memberships WHERE tenant_id=p_tenant AND status='active';
 IF cap IS NOT NULL AND used>=cap AND NOT EXISTS(
  SELECT 1 FROM tenant_memberships m JOIN auth.users u ON u.id=m.auth_user_id
  WHERE m.tenant_id=p_tenant AND m.status='active' AND lower(u.email)=lower(trim(p_email))
 ) THEN RAISE EXCEPTION 'Límite de usuarios del plan alcanzado'; END IF;
 INSERT INTO tenant_invitations(tenant_id,email,role,status,token_hash,invited_by,expires_at,email_status)
 VALUES(p_tenant,lower(trim(p_email)),'tenant_admin','pending',p_hash,auth.uid(),now()+interval '1 hour','not_sent')
 ON CONFLICT(tenant_id,email) DO UPDATE SET role='tenant_admin',status='pending',token_hash=p_hash,
 invited_by=auth.uid(),expires_at=now()+interval '1 hour',accepted_by=NULL,accepted_at=NULL,email_status='not_sent'
 RETURNING * INTO i;
 INSERT INTO platform_audit_logs(actor_id,tenant_id,action,resource,resource_id)
 VALUES(auth.uid(),p_tenant,'tenant.invitation.prepare','tenant_invitations',i.id::text);
 RETURN jsonb_build_object('id',i.id,'email',i.email,'status',i.status,'expires_at',i.expires_at);
END; $$;

CREATE FUNCTION public.vora_accept_admin_invitation(p_invitation uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i tenant_invitations; u auth.users; target_slug text; target_tenant uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
 SELECT * INTO u FROM auth.users WHERE id=auth.uid();
 IF u.id IS NULL OR u.email IS NULL OR u.email_confirmed_at IS NULL THEN RAISE EXCEPTION 'Confirma tu correo'; END IF;
 SELECT tenant_id INTO target_tenant FROM tenant_invitations WHERE id=p_invitation;
 -- Consistent lock order with preparation and the membership quota trigger.
 PERFORM 1 FROM tenants WHERE id=target_tenant FOR UPDATE;
 SELECT * INTO i FROM tenant_invitations WHERE id=p_invitation FOR UPDATE;
 IF i.id IS NULL OR lower(i.email)<>lower(u.email) OR i.role<>'tenant_admin' THEN RAISE EXCEPTION 'Invitación inválida'; END IF;
 IF i.status='accepted' AND i.accepted_by=u.id THEN
  IF NOT EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id=i.tenant_id AND auth_user_id=u.id AND status='active') THEN RAISE EXCEPTION 'Acceso desactivado'; END IF;
 ELSIF i.status='pending' AND i.expires_at>now() THEN
  INSERT INTO tenant_memberships(tenant_id,auth_user_id,role,status) VALUES(i.tenant_id,u.id,'tenant_admin','active')
  ON CONFLICT(tenant_id,auth_user_id) DO UPDATE SET role='tenant_admin',status='active';
  UPDATE tenant_invitations SET status='accepted',accepted_by=u.id,accepted_at=now() WHERE id=i.id;
  INSERT INTO platform_audit_logs(actor_id,tenant_id,action,resource,resource_id)
  VALUES(u.id,i.tenant_id,'tenant.invitation.accept','tenant_memberships',u.id::text);
 ELSE RAISE EXCEPTION 'Invitación vencida o revocada'; END IF;
 SELECT slug INTO target_slug FROM tenants WHERE id=i.tenant_id;
 RETURN target_slug;
END; $$;
REVOKE ALL ON FUNCTION public.vora_prepare_admin_invitation(uuid,text,text),public.vora_accept_admin_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vora_prepare_admin_invitation(uuid,text,text),public.vora_accept_admin_invitation(uuid) TO authenticated;
COMMIT;
