import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Auto-load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').replace(/^["']|["']$/g, '').trim();
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    });
  }
} catch (e) {
  // ignore
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('placeholder') || supabaseUrl.includes('dummy')) {
  console.error('\n❌ Missing credentials in .env.local:');
  console.error('Please make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set with your real Supabase keys in .env.local\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const adminEmail = process.argv[2] || 'admin@company.com';
  const adminPassword = process.argv[3] || 'Admin@123456';
  const adminName = process.argv[4] || 'Super Administrator';

  console.log(`\n⏳ Creating Admin user in Supabase: ${adminEmail}...`);

  const { data: user, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      role: 'admin',
      full_name: adminName,
    },
  });

  if (authError) {
    const msg = (authError.message || '').toLowerCase();
    if (msg.includes('already registered') || msg.includes('already been registered') || authError.status === 422) {
      console.log(`ℹ️ User ${adminEmail} already exists in auth. Setting role to admin in profiles...`);
      const { data: existingUser, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) {
        console.error('Failed to list users:', listErr);
      }
      const matched = existingUser?.users?.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
      if (matched) {
        const { error: upErr } = await supabase.from('profiles').upsert({
          id: matched.id,
          role: 'admin',
          full_name: adminName,
          email: adminEmail,
          is_active: true,
          must_change_password: false,
          consent_given: true,
        });
        if (upErr) {
          console.error('Failed to update profile:', upErr);
          process.exit(1);
        }
        console.log(`\n🎉 Profile for ${adminEmail} is now verified as Admin!`);
        console.log(`📧 Email:    ${adminEmail}`);
        console.log(`👤 Role:     Administrator\n`);
        return;
      }
    }
    console.error('❌ Failed to create auth user:', authError.message);
    process.exit(1);
  }

  const userId = user.user.id;

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      role: 'admin',
      full_name: adminName,
      email: adminEmail,
      is_active: true,
      must_change_password: false,
      consent_given: true,
    });

  if (profileError) {
    console.error('❌ Failed to create profile record:', profileError.message);
    process.exit(1);
  }

  console.log('\n🎉 Admin account successfully created!');
  console.log(`📧 Email:    ${adminEmail}`);
  console.log(`🔑 Password: ${adminPassword}`);
  console.log(`👤 Role:     Administrator\n`);
}

main();
