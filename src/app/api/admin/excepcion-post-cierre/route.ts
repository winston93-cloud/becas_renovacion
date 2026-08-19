/**
 * GET — listado / PDF
 * POST — generar PDF y enviar correos a familias (excepción post-cierre)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import {
  fetchExcepcionFamilias,
} from '@/lib/excepcion-post-cierre-data';
import { buildExcepcionPostCierreListaPdf } from '@/lib/pdf/excepcion-post-cierre-lista';
import {
  buildExcepcionPostCierreEmailHtml,
  buildExcepcionPostCierreEmailSubject,
  emailDataFromFamilia,
  EXCEPCION_POST_CIERRE_BCC,
} from '@/lib/email-excepcion-post-cierre';
import {
  resolveAccesoAutorizadoDestinatarios,
} from '@/lib/email-acceso-autorizado';
import { sendMail, getMailFrom } from '@/lib/mailer';
import { emailBccSistemas } from '@/lib/email-renovacion';

export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function bccLista(): string[] {
  const out = new Set<string>();
  out.add(EXCEPCION_POST_CIERRE_BCC);
  const extra = emailBccSistemas();
  if (extra) out.add(extra);
  return [...out];
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const todos = request.nextUrl.searchParams.get('todos') === '1';
    const format = request.nextUrl.searchParams.get('format');

    const admin = getInsforgeAdmin();
    const { ciclo, ciclo_label, familias } = await fetchExcepcionFamilias(admin, {
      niveles: todos ? undefined : auth.admin.niveles,
    });

    if (format === 'pdf') {
      const pdf = await buildExcepcionPostCierreListaPdf({
        ciclo_label,
        familias,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="excepcion-post-cierre-${stamp}.pdf"`,
        },
      });
    }

    return NextResponse.json({
      ciclo,
      ciclo_label,
      total: familias.length,
      familias: familias.map(({ alumno_id: _id, alumno_nivel: _n, alumno_grado: _g, nivel_label: _nl, ...rest }) => rest),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const todosNiveles = body.todos_niveles !== false;

    const admin = getInsforgeAdmin();
    const { ciclo_label, familias } = await fetchExcepcionFamilias(admin, {
      niveles: todosNiveles ? undefined : auth.admin.niveles,
    });

    type EnvioRow = {
      alumno_ref: string;
      nombre: string;
      to: string[];
      ok: boolean;
      error?: string;
      skipped?: string;
    };
    const envios: EnvioRow[] = [];

    if (!dryRun) {
      for (const f of familias) {
        const { data: alumno } = await admin.database
          .from('alumno')
          .select(
            'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel'
          )
          .eq('alumno_id', f.alumno_id)
          .maybeSingle();

        if (!alumno) {
          envios.push({
            alumno_ref: f.alumno_ref,
            nombre: f.nombre,
            to: [],
            ok: false,
            error: 'Alumno no encontrado',
          });
          continue;
        }

        const dest = await resolveAccesoAutorizadoDestinatarios({
          db: admin.database,
          alumno_id: f.alumno_id,
          alumno_ref: alumno.alumno_ref,
          alumno_app: alumno.alumno_app,
          alumno_apm: alumno.alumno_apm,
          alumno_nombre: alumno.alumno_nombre,
        });

        if (dest.sin_correo || dest.to.length === 0) {
          envios.push({
            alumno_ref: f.alumno_ref,
            nombre: f.nombre,
            to: [],
            ok: false,
            skipped: 'Sin correo de padres registrado',
          });
          continue;
        }

        const emailData = emailDataFromFamilia(f, ciclo_label);
        try {
          await sendMail({
            to: dest.to,
            bcc: bccLista(),
            subject: buildExcepcionPostCierreEmailSubject(emailData),
            html: buildExcepcionPostCierreEmailHtml(emailData),
          });
          envios.push({
            alumno_ref: f.alumno_ref,
            nombre: f.nombre,
            to: dest.to,
            ok: true,
          });
        } catch (mailErr) {
          envios.push({
            alumno_ref: f.alumno_ref,
            nombre: f.nombre,
            to: dest.to,
            ok: false,
            error:
              mailErr instanceof Error ? mailErr.message : 'Error SMTP',
          });
        }

        await sleep(800);
      }
    }

    const meta = clientMetaFromRequest(request);
    await registrarAuditoria(auth.admin, {
      accion: 'excepcion_post_cierre.enviar',
      entidad: 'renovacion',
      detalle: {
        dry_run: dryRun,
        total_familias: familias.length,
        enviados: envios.filter((e) => e.ok).length,
        fallidos: envios.filter((e) => !e.ok && !e.skipped).length,
        sin_correo: envios.filter((e) => e.skipped).length,
        bcc: bccLista(),
        remitente: getMailFrom(),
      },
      ...meta,
    });

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      total_familias: familias.length,
      envios: dryRun
        ? familias.map((f) => ({
            alumno_ref: f.alumno_ref,
            nombre: f.nombre,
            docs: f.docs_incorrectos.map((d) => d.label),
          }))
        : envios,
      remitente: getMailFrom(),
      bcc: bccLista(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
