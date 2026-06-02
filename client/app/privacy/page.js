'use client';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function PrivacyPage() {
  const { lang } = useAuth();
  const th = lang === 'th';

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
          <p className="text-slate-500 text-xs">{th ? 'อัปเดตล่าสุด: 1 มิถุนายน 2569' : 'Last updated: June 1, 2026'}</p>
        </div>

        {th ? (
          <>
            <Section title="1. บทนำ">
              CardMatch ดำเนินการโดยบุคคลธรรมดา ให้บริการแพลตฟอร์มจับคู่ผู้เล่นการ์ดเกมผ่านวิดีโอสด นโยบายนี้อธิบายการเก็บ ใช้ และคุ้มครองข้อมูลส่วนบุคคลของคุณ ภายใต้ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
            </Section>
            <Section title="2. ข้อมูลที่เราเก็บรวบรวม">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>ข้อมูลบัญชี:</b> ชื่อผู้ใช้ อีเมล รหัสผ่านที่เข้ารหัส (bcrypt)</li>
                <li><b>ข้อมูลจาก Google:</b> ชื่อ Email รูปโปรไฟล์ (เฉพาะเมื่อใช้ Google Sign-In)</li>
                <li><b>ข้อมูลกิจกรรม:</b> สถิติการแข่งขัน</li>
                <li><b>ข้อมูลการเชื่อมต่อ:</b> หมายเลข IP เวลาเชื่อมต่อ (เพื่อความปลอดภัย)</li>
                <li><b>การสื่อสาร:</b> ข้อความแชทสาธารณะและแชทในห้องแข่งขัน</li>
              </ul>
            </Section>
            <Section title="3. วิดีโอและเสียง">
              การสนทนาผ่านวิดีโอและเสียงเป็นแบบ <b>Peer-to-Peer (P2P) โดยตรง</b> — <b>ระบบไม่บันทึก ไม่จัดเก็บ และไม่มีการส่งวิดีโอ/เสียงผ่านเซิร์ฟเวอร์ของเรา</b>
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
              เราไม่ขาย ไม่ให้เช่า และไม่เปิดเผยข้อมูลส่วนบุคคลแก่บุคคลภายนอก ยกเว้น:
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><b>ผู้ให้บริการโครงสร้างพื้นฐาน:</b> Vercel (hosting), Railway (server/database)</li>
                <li><b>Google:</b> เฉพาะเมื่อใช้ Google Sign-In</li>
                <li><b>ตามกฎหมาย:</b> หากได้รับคำสั่งศาลหรือหน่วยงานรัฐ</li>
              </ul>
            </Section>
            <Section title="6. ระยะเวลาการเก็บข้อมูล">
              <ul className="list-disc pl-5 space-y-1">
                <li>ข้อมูลบัญชี: เก็บจนกว่าผู้ใช้จะขอลบบัญชี</li>
                <li>ประวัติการแข่งขัน: เก็บตลอดอายุบัญชี</li>
                <li>แชทสาธารณะ: เก็บเฉพาะ 50 ข้อความล่าสุดในหน่วยความจำ (ไม่เก็บถาวร รีเซ็ตเมื่อ server รีสตาร์ท)</li>
                <li>Log การเชื่อมต่อ: ไม่มีการเก็บ log อย่างถาวร (จัดการโดย Railway infrastructure)</li>
              </ul>
            </Section>
            <Section title="7. สิทธิ์ของเจ้าของข้อมูล (ตาม PDPA)">
              <ul className="list-disc pl-5 space-y-1">
                <li>สิทธิ์เข้าถึง แก้ไข ลบ และคัดค้านการประมวลผลข้อมูล</li>
                <li>ลบบัญชีด้วยตนเองได้ที่: <b>โปรไฟล์ → โซนอันตราย → ลบบัญชีของฉัน</b></li>
              </ul>
              ติดต่อขอใช้สิทธิ์: <b>cardmatch2569@gmail.com</b>
            </Section>
            <Section title="8. ความปลอดภัยของข้อมูล">
              <ul className="list-disc pl-5 space-y-1">
                <li>รหัสผ่านเข้ารหัสด้วย bcrypt ก่อนบันทึก</li>
                <li>การสื่อสารทั้งหมดผ่าน HTTPS/TLS</li>
                <li>JWT token มีอายุ 7 วัน</li>
                <li>ไม่จัดเก็บข้อมูลบัตรเครดิตหรือข้อมูลการชำระเงิน</li>
              </ul>
            </Section>
            <Section title="9. การละเมิดข้อมูลส่วนบุคคล">
              หากเกิดการละเมิดที่มีความเสี่ยงสูง เราจะแจ้ง PDPC ภายใน 72 ชั่วโมง ตามมาตรา 37(4) และแจ้งผู้ใช้ที่ได้รับผลกระทบผ่านระบบประชาสัมพันธ์โดยเร็วที่สุด
              ติดต่อรายงานปัญหาความปลอดภัย: <b>cardmatch2569@gmail.com</b>
            </Section>
            <Section title="10. ผู้เยาว์">
              บริการนี้ไม่ได้มุ่งหมายสำหรับผู้มีอายุต่ำกว่า 13 ปี
            </Section>
            <Section title="11. การเปลี่ยนแปลงนโยบาย">
              เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว โดยจะแจ้งผ่านระบบประชาสัมพันธ์ในแอปพลิเคชัน
            </Section>
            <Section title="12. ติดต่อเรา">
              <b>อีเมล:</b> cardmatch2569@gmail.com
            </Section>
          </>
        ) : (
          <>
            <Section title="1. Introduction">
              CardMatch is operated by an individual, providing a platform for matching card game players via live video. This policy explains how we handle your personal data under Thailand's PDPA B.E. 2562.
            </Section>
            <Section title="2. Data We Collect">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Account data:</b> Username, email, bcrypt-hashed password</li>
                <li><b>Google data:</b> Name, email, profile picture (if using Google Sign-In)</li>
                <li><b>Activity data:</b> Match statistics</li>
                <li><b>Connection data:</b> IP address, connection timestamps</li>
                <li><b>Communications:</b> Public chat and in-match chat messages</li>
              </ul>
            </Section>
            <Section title="3. Video and Audio">
              Video and audio are <b>Peer-to-Peer (P2P)</b> — <b>not recorded, stored, or routed through our servers.</b>
            </Section>
            <Section title="4. How We Use Data">
              Identity verification, matchmaking, preventing misuse, and improving the service.
            </Section>
            <Section title="5. Third-Party Disclosure">
              We do not sell or share personal data except with: Vercel (hosting), Railway (server/database), Google (if using Sign-In), or as required by law.
            </Section>
            <Section title="6. Retention Period">
              <ul className="list-disc pl-5 space-y-1">
                <li>Account data: Until deletion request</li>
                <li>Match history: Lifetime of account</li>
                <li>Public chat: Last 50 messages in memory only (resets on server restart)</li>
                <li>Connection logs: Not permanently stored</li>
              </ul>
            </Section>
            <Section title="7. Your Rights (PDPA)">
              You have rights to access, rectify, erase, and object. Delete your account via <b>Profile → Danger Zone → Delete my account</b>.
              Contact: <b>cardmatch2569@gmail.com</b>
            </Section>
            <Section title="8. Security">
              Passwords bcrypt-hashed, HTTPS/TLS, JWT 7-day expiry, no payment data stored.
            </Section>
            <Section title="9. Data Breach">
              In case of high-risk breach, we will notify PDPC within 72 hours and affected users via in-app announcement. Report security issues to: <b>cardmatch2569@gmail.com</b>
            </Section>
            <Section title="10. Minors">
              Not intended for users under 13.
            </Section>
            <Section title="11. Changes">
              Policy updates will be announced via the in-app announcement system.
            </Section>
            <Section title="12. Contact">
              <b>Email:</b> cardmatch2569@gmail.com
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
