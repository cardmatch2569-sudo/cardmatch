'use client';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function PrivacyPage() {
  const { lang } = useAuth();
  const th = lang === 'th';
  const updated = '1 มิถุนายน 2569' ;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <Link href="/" className="text-slate-500 hover:text-white text-sm transition">← {th ? 'กลับหน้าหลัก' : 'Back to Home'}</Link>
      </div>

      <div className="card p-6 md:p-8 space-y-6 text-sm text-slate-300 leading-relaxed">
        <div className="border-b border-[var(--border)] pb-5">
          <h1 className="text-2xl font-bold text-white mb-1">
            {th ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
          </h1>
          <p className="text-slate-500 text-xs">{th ? `อัปเดตล่าสุด: ${updated}` : `Last updated: June 1, 2026`}</p>
        </div>

        {th ? (
          <>
            <Section title="1. บทนำ">
              CardMatch ("บริการ") ดำเนินการโดยบุคคลธรรมดา ให้บริการแพลตฟอร์มจับคู่ผู้เล่นการ์ดเกมผ่านวิดีโอสด นโยบายนี้อธิบายการเก็บ ใช้ และคุ้มครองข้อมูลส่วนบุคคลของคุณ ภายใต้ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
            </Section>

            <Section title="2. ข้อมูลที่เราเก็บรวบรวม">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>ข้อมูลบัญชี:</b> ชื่อผู้ใช้ (Username), อีเมล, รหัสผ่านที่เข้ารหัส (bcrypt)</li>
                <li><b>ข้อมูลจาก Google:</b> หากเลือกเข้าสู่ระบบด้วย Google — ชื่อ, Email, รูปโปรไฟล์จาก Google Account</li>
                <li><b>ข้อมูลกิจกรรม:</b> สถิติการแข่งขัน (จำนวนเกม, ชนะ, แพ้)</li>
                <li><b>ข้อมูลการเชื่อมต่อ:</b> หมายเลข IP, เวลาเชื่อมต่อ (เพื่อความปลอดภัย)</li>
                <li><b>การสื่อสาร:</b> ข้อความแชทสาธารณะในล็อบบี้ และแชทในห้องแข่งขัน</li>
              </ul>
            </Section>

            <Section title="3. วิดีโอและเสียง">
              การสนทนาผ่านวิดีโอและเสียงระหว่างผู้เล่นเป็นแบบ <b>Peer-to-Peer (P2P) โดยตรง</b> — <b>ระบบไม่บันทึก ไม่จัดเก็บ และไม่มีการส่งวิดีโอ/เสียงผ่านเซิร์ฟเวอร์ของเรา</b> ข้อมูลวิดีโอ/เสียงอยู่ระหว่างอุปกรณ์ผู้เล่นทั้งสองฝ่ายเท่านั้น
            </Section>

            <Section title="4. วัตถุประสงค์การใช้ข้อมูล">
              <ul className="list-disc pl-5 space-y-1">
                <li>ยืนยันตัวตนและจัดการบัญชี</li>
                <li>จับคู่ผู้เล่นสำหรับการแข่งขัน</li>
                <li>ป้องกันการใช้งานที่ไม่เหมาะสม</li>
                <li>ปรับปรุงและพัฒนาบริการ</li>
              </ul>
            </Section>

            <Section title="5. การเปิดเผยข้อมูลต่อบุคคลที่สาม">
              เราไม่ขาย ไม่ให้เช่า และไม่เปิดเผยข้อมูลส่วนบุคคลของคุณแก่บุคคลภายนอก ยกเว้น:
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><b>ผู้ให้บริการโครงสร้างพื้นฐาน:</b> Vercel (hosting), Railway (server/database) — ผูกพันตาม GDPR/data processing agreements</li>
                <li><b>Google:</b> เฉพาะเมื่อใช้ Google Sign-In</li>
                <li><b>ตามกฎหมาย:</b> หากได้รับคำสั่งศาลหรือหน่วยงานรัฐ</li>
              </ul>
            </Section>

            <Section title="6. ระยะเวลาการเก็บข้อมูล">
              <ul className="list-disc pl-5 space-y-1">
                <li>ข้อมูลบัญชี: เก็บจนกว่าผู้ใช้จะยื่นคำขอลบบัญชี หรือ Admin ลบออกจากระบบ</li>
                <li>ประวัติการแข่งขัน: เก็บตลอดอายุบัญชี</li>
                <li>ข้อความแชทสาธารณะ: เก็บเฉพาะ 50 ข้อความล่าสุดในหน่วยความจำเซิร์ฟเวอร์ (ไม่เก็บถาวรในฐานข้อมูล)</li>
                <li>Log การเชื่อมต่อ: ไม่เกิน 30 วัน</li>
              </ul>
            </Section>

            <Section title="7. สิทธิ์ของเจ้าของข้อมูล (ตาม PDPA)">
              คุณมีสิทธิ์ดังต่อไปนี้:
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>สิทธิ์เข้าถึง — ขอดูข้อมูลที่เราเก็บของคุณ</li>
                <li>สิทธิ์แก้ไข — ขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
                <li>สิทธิ์ลบ — ขอให้ลบบัญชีและข้อมูลทั้งหมด</li>
                <li>สิทธิ์คัดค้าน — คัดค้านการประมวลผลข้อมูลในบางกรณี</li>
              </ul>
              ติดต่อขอใช้สิทธิ์ได้ที่: <b>chakkarink@lanna.co.th</b>
            </Section>

            <Section title="8. ความปลอดภัยของข้อมูล">
              <ul className="list-disc pl-5 space-y-1">
                <li>รหัสผ่านเข้ารหัสด้วย bcrypt ก่อนบันทึก</li>
                <li>การสื่อสารทั้งหมดผ่าน HTTPS/TLS</li>
                <li>Token ยืนยันตัวตน (JWT) มีอายุ 7 วัน</li>
                <li>ไม่จัดเก็บข้อมูลบัตรเครดิตหรือข้อมูลการชำระเงิน</li>
              </ul>
            </Section>

            <Section title="9. ผู้เยาว์">
              บริการนี้ไม่ได้มุ่งหมายสำหรับผู้มีอายุต่ำกว่า 13 ปี หากทราบว่าผู้เยาว์ได้ให้ข้อมูลส่วนบุคคล จะดำเนินการลบข้อมูลนั้นทันที
            </Section>

            <Section title="10. การเปลี่ยนแปลงนโยบาย">
              เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว โดยจะแจ้งผ่านระบบประชาสัมพันธ์ในแอปพลิเคชัน การใช้บริการต่อเนื่องหลังจากการแจ้งเตือนถือว่ายอมรับนโยบายใหม่
            </Section>

            <Section title="11. ติดต่อเรา">
              หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว ติดต่อได้ที่:<br />
              <b>อีเมล:</b> chakkarink@lanna.co.th
            </Section>
          </>
        ) : (
          <>
            <Section title="1. Introduction">
              CardMatch ("Service") is operated by an individual, providing a platform for matching card game players via live video. This policy explains how we collect, use, and protect your personal data under Thailand's Personal Data Protection Act B.E. 2562 (PDPA).
            </Section>
            <Section title="2. Data We Collect">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Account data:</b> Username, email, bcrypt-hashed password</li>
                <li><b>Google data:</b> If using Google Sign-In — name, email, profile picture</li>
                <li><b>Activity data:</b> Match statistics (games, wins, losses)</li>
                <li><b>Connection data:</b> IP address, connection timestamps (for security)</li>
                <li><b>Communications:</b> Public lobby chat and in-match chat messages</li>
              </ul>
            </Section>
            <Section title="3. Video and Audio">
              Video and audio calls are <b>Peer-to-Peer (P2P) direct connections</b> — <b>the system does not record, store, or route video/audio through our servers.</b> This data exists only between the two players' devices.
            </Section>
            <Section title="4. How We Use Data">
              <ul className="list-disc pl-5 space-y-1">
                <li>Identity verification and account management</li>
                <li>Matching players for matches</li>
                <li>Preventing misuse</li>
                <li>Improving the service</li>
              </ul>
            </Section>
            <Section title="5. Third-Party Disclosure">
              We do not sell, rent, or disclose personal data to third parties, except:
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><b>Infrastructure providers:</b> Vercel (hosting), Railway (server/database) — bound by data processing agreements</li>
                <li><b>Google:</b> Only when using Google Sign-In</li>
                <li><b>Legal obligations:</b> If required by court order or government authority</li>
              </ul>
            </Section>
            <Section title="6. Retention Period">
              <ul className="list-disc pl-5 space-y-1">
                <li>Account data: Until deletion request or Admin removal</li>
                <li>Match history: For the lifetime of the account</li>
                <li>Public chat: Last 50 messages in server memory only (not stored in database)</li>
                <li>Connection logs: Up to 30 days</li>
              </ul>
            </Section>
            <Section title="7. Your Rights (PDPA)">
              You have the right to: access, rectify, erase, and object to processing of your personal data.
              Contact us at: <b>chakkarink@lanna.co.th</b>
            </Section>
            <Section title="8. Security">
              <ul className="list-disc pl-5 space-y-1">
                <li>Passwords are bcrypt-hashed before storage</li>
                <li>All communication over HTTPS/TLS</li>
                <li>JWT tokens expire after 7 days</li>
                <li>No payment or credit card data is stored</li>
              </ul>
            </Section>
            <Section title="9. Minors">
              The service is not intended for users under 13 years of age.
            </Section>
            <Section title="10. Changes">
              We may update this policy and will notify users via the in-app announcement system.
            </Section>
            <Section title="11. Contact">
              <b>Email:</b> chakkarink@lanna.co.th
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-white font-bold text-base mb-2">{title}</h2>
      <div className="text-slate-400 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
