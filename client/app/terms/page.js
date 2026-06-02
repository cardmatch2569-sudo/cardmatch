'use client';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function TermsPage() {
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
            {th ? 'ข้อกำหนดการใช้งาน' : 'Terms of Service'}
          </h1>
          <p className="text-slate-500 text-xs">{th ? 'อัปเดตล่าสุด: 1 มิถุนายน 2569' : 'Last updated: June 1, 2026'}</p>
        </div>

        {th ? (
          <>
            <Section title="1. การยอมรับข้อกำหนด">
              การใช้บริการ CardMatch ถือว่าคุณยอมรับข้อกำหนดเหล่านี้ทั้งหมด หากไม่เห็นด้วย กรุณาหยุดใช้บริการ
            </Section>

            <Section title="2. คุณสมบัติผู้ใช้">
              <ul className="list-disc pl-5 space-y-1">
                <li>ต้องมีอายุ 13 ปีขึ้นไป</li>
                <li>ผู้ที่อายุต่ำกว่า 18 ปี ควรได้รับความยินยอมจากผู้ปกครอง</li>
                <li>ต้องให้ข้อมูลที่ถูกต้องและเป็นความจริงในการสมัคร</li>
              </ul>
            </Section>

            <Section title="3. บัญชีผู้ใช้">
              <ul className="list-disc pl-5 space-y-1">
                <li>คุณรับผิดชอบต่อการรักษาความลับของรหัสผ่าน</li>
                <li>ห้ามสร้างบัญชีปลอม หรือแอบอ้างเป็นบุคคลอื่น</li>
                <li>ห้ามใช้ชื่อผู้ใช้ที่มีเนื้อหาหยาบคาย หรือส่อเสียด</li>
                <li>หนึ่งบุคคลต่อหนึ่งบัญชีเท่านั้น</li>
              </ul>
            </Section>

            <Section title="4. การใช้งานที่ยอมรับได้">
              คุณตกลงที่จะไม่:
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>แสดงเนื้อหาที่ไม่เหมาะสม ลามกอนาจาร หรือรุนแรง ผ่านกล้องหรือแชท</li>
                <li>คุกคาม ข่มขู่ หรือสร้างความเดือดร้อนแก่ผู้เล่นอื่น</li>
                <li>บันทึกวิดีโอหรือเสียงของผู้เล่นอื่นโดยไม่ได้รับอนุญาต</li>
                <li>พยายามเจาะระบบ หรือทำให้บริการหยุดทำงาน</li>
                <li>ใช้บอทหรือโปรแกรมอัตโนมัติในการเล่น</li>
                <li>ละเมิดลิขสิทธิ์หรือทรัพย์สินทางปัญญาของผู้อื่น</li>
              </ul>
            </Section>

            <Section title="5. การสนทนาผ่านวิดีโอ">
              <ul className="list-disc pl-5 space-y-1">
                <li>วิดีโอและเสียงเป็นแบบ Peer-to-Peer — ระบบไม่บันทึก</li>
                <li>ผู้เล่นต้องไม่บันทึกหน้าจอหรือวิดีโอของผู้เล่นอื่นโดยไม่ยินยอม</li>
                <li>การกระทำดังกล่าวอาจผิดกฎหมาย พ.ร.บ. ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ และกฎหมายอื่นที่เกี่ยวข้อง</li>
              </ul>
            </Section>

            <Section title="6. เนื้อหาและการสื่อสาร">
              ข้อความในแชทสาธารณะและในห้องแข่งขันต้อง:
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>ไม่มีเนื้อหาหยาบคาย เหยียดหยาม หรือก่อให้เกิดความแตกแยก</li>
                <li>ไม่แชร์ข้อมูลส่วนบุคคลของผู้อื่น</li>
                <li>ไม่โฆษณาหรือสแปม</li>
              </ul>
            </Section>

            <Section title="7. ทรัพย์สินทางปัญญาของบุคคลที่สาม">
              CardMatch เป็นแพลตฟอร์มอำนวยการจับคู่ผู้เล่น <b>ไม่ใช่ตัวแทน พันธมิตร หรือผู้ได้รับการรับรอง</b>จากเจ้าของสิทธิ์เกมใดๆ ชื่อเกม เครื่องหมายการค้า และลิขสิทธิ์ทั้งหมดเป็นสมบัติของเจ้าของที่เกี่ยวข้อง ผู้ใช้ต้องไม่กระทำการใดที่ละเมิดทรัพย์สินทางปัญญาของบุคคลที่สามบนแพลตฟอร์มนี้
            </Section>

            <Section title="8. การระงับและยกเลิกบัญชี">
              เราขอสงวนสิทธิ์ระงับหรือลบบัญชีของผู้ใช้ที่ฝ่าฝืนข้อกำหนดเหล่านี้โดยไม่ต้องแจ้งล่วงหน้า
            </Section>

            <Section title="8. การปฏิเสธความรับผิด">
              <ul className="list-disc pl-5 space-y-1">
                <li>บริการนี้ให้บริการ "ตามที่มีอยู่" โดยไม่มีการรับประกันใด ๆ</li>
                <li>เราไม่รับผิดชอบต่อความเสียหายที่เกิดจากการใช้บริการ</li>
                <li>เราไม่รับผิดชอบต่อพฤติกรรมของผู้ใช้คนอื่น</li>
                <li>บริการอาจหยุดให้บริการชั่วคราวหรือถาวรได้โดยไม่ต้องแจ้งล่วงหน้า</li>
              </ul>
            </Section>

            <Section title="9. กฎหมายที่ใช้บังคับ">
              ข้อกำหนดเหล่านี้อยู่ภายใต้กฎหมายไทย ข้อพิพาทใด ๆ ให้อยู่ในเขตอำนาจศาลไทย
            </Section>

            <Section title="10. ติดต่อเรา">
              <b>อีเมล:</b> chakkarink@lanna.co.th
            </Section>
          </>
        ) : (
          <>
            <Section title="1. Acceptance">By using CardMatch, you agree to these terms. If you disagree, please stop using the service.</Section>
            <Section title="2. Eligibility">You must be at least 13 years old. Users under 18 should have parental consent.</Section>
            <Section title="3. Accounts">You are responsible for maintaining account security. Do not impersonate others or create fake accounts.</Section>
            <Section title="4. Acceptable Use">You agree not to display inappropriate content, harass other players, record others without consent, attempt to hack the system, or use bots.</Section>
            <Section title="5. Video Calls">Video is P2P — we do not record. You must not record other players without their consent. Doing so may violate Thai law.</Section>
            <Section title="6. Content">Chat messages must not contain offensive, hateful, or spam content.</Section>
            <Section title="7. Third-Party Intellectual Property">CardMatch is a matchmaking facilitation platform. It is <b>not affiliated with, endorsed by, or a representative</b> of any game publisher. All game names, trademarks, and copyrights are the property of their respective owners. Users must not infringe third-party intellectual property on this platform.</Section>
            <Section title="8. Termination">We reserve the right to suspend or delete accounts that violate these terms without prior notice.</Section>
            <Section title="8. Disclaimer">The service is provided "as is" with no warranties. We are not responsible for user behavior or service interruptions.</Section>
            <Section title="9. Governing Law">These terms are governed by Thai law.</Section>
            <Section title="10. Contact"><b>Email:</b> chakkarink@lanna.co.th</Section>
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
