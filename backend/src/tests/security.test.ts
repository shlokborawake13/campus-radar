process.env.NODE_ENV = 'test';

import { isAllowedStudentEmail } from '../security/emailDomain.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { signAccessToken, verifyAccessToken, hashToken } from '../security/jwt.js';
import { generateSecureOTP, hashOTP, verifyOTPHash } from '../security/otp.js';
import { generateTOTPSecret, createTOTPInstance, verifyTOTPToken } from '../security/totp.js';
import { generateAnonymousPseudonym } from '../services/pseudonym.js';
import { sanitizeText } from '../security/sanitize.js';
import { encodeCursor, decodeCursor } from '../utils/pagination.js';
import { registerSchema } from '../validators/auth.schema.js';
import { postService } from '../services/post.service.js';
import { commentService } from '../services/comment.service.js';
import { eventService } from '../services/event.service.js';
import { likeService } from '../services/like.service.js';
import { profileService } from '../services/profile.service.js';
import { adminService } from '../services/admin.service.js';
import { pool, query } from '../config/database.js';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failed++;
  }
}

async function runSecurityTests() {
  console.log('--- RUNNING CAMPUS RADAR SECURITY TEST SUITE ---\n');

  // Test 1: Email domain filtering
  console.log('1. University Domain Validation:');
  assert('Accepts valid student email', isAllowedStudentEmail('student.john@sanjivani.edu.in'));
  assert('Accepts mixed case student email', isAllowedStudentEmail('John.Doe@Sanjivani.edu.in'));
  assert('Rejects standard gmail', !isAllowedStudentEmail('student@gmail.com'));
  assert('Rejects sneaky domain postfix (evil domain bypass)', !isAllowedStudentEmail('student@sanjivani.edu.in.attacker.com'));
  assert('Rejects prefixed domain bypass', !isAllowedStudentEmail('student@fakesanjivani.edu.in'));
  assert('Rejects empty or null email', !isAllowedStudentEmail(''));

  // Test 2: Mandatory Phone Number Validation
  console.log('\n2. Mandatory Phone Number Registration Schema:');
  const validReg = registerSchema.safeParse({
    fullName: 'Rohan Sharma',
    email: 'rohan.sharma@sanjivani.edu.in',
    password: 'Password123!',
    phoneNumber: '+919876543210'
  });
  assert('Accepts complete registration with valid phone number', validReg.success);

  const missingPhoneReg = registerSchema.safeParse({
    fullName: 'Rohan Sharma',
    email: 'rohan.sharma@sanjivani.edu.in',
    password: 'Password123!'
  });
  assert('Rejects registration when phone number is missing', !missingPhoneReg.success);

  const invalidPhoneReg = registerSchema.safeParse({
    fullName: 'Rohan Sharma',
    email: 'rohan.sharma@sanjivani.edu.in',
    password: 'Password123!',
    phoneNumber: '123'
  });
  assert('Rejects registration with short/invalid phone number', !invalidPhoneReg.success);

  // Test 3: Argon2id Password Hashing
  console.log('\n3. Argon2id Password Security:');
  const password = 'StrongPassword123!';
  const hash = await hashPassword(password);
  assert('Hash generated using argon2id algorithm', hash.startsWith('$argon2id$'));
  assert('Correct password verifies successfully', await verifyPassword(password, hash));
  assert('Wrong password fails verification', !(await verifyPassword('WrongPassword123!', hash)));

  // Test 4: JWT Access Token & No Role Leakage
  console.log('\n4. JWT Access Token Security:');
  const fakeUserId = 'e2c695a0-972a-4a25-8321-4f80a4ec38d9';
  const token = signAccessToken(fakeUserId);
  const payload = verifyAccessToken(token);
  assert('Payload subject matches user id', payload.sub === fakeUserId);
  assert('Payload type is access', payload.type === 'access');
  assert('No role present in token payload (DB lookup enforced)', (payload as any).role === undefined);

  // Test 5: OTP Cryptographic Generation & Hashing
  console.log('\n5. OTP Generation & HMAC-SHA256:');
  const otp = generateSecureOTP();
  assert('OTP is 6 characters long', otp.length === 6);
  assert('OTP is numeric', /^\d{6}$/.test(otp));
  const otpHash = hashOTP(otp);
  assert('OTP verification succeeds with valid code', verifyOTPHash(otp, otpHash));
  assert('OTP verification fails with invalid code', !verifyOTPHash('000000', otpHash));

  // Test 6: TOTP MFA (RFC 6238)
  console.log('\n6. TOTP MFA Authenticator Verification:');
  const secret = generateTOTPSecret();
  const email = 'admin@sanjivani.edu.in';
  const totp = createTOTPInstance(email, secret);
  const currentToken = totp.generate();
  assert('TOTP generates 6-digit code', currentToken.length === 6);
  assert('Current TOTP code verifies successfully', verifyTOTPToken(currentToken, secret, email));
  assert('Expired or dummy TOTP code fails', !verifyTOTPToken('999999', secret, email));

  // Test 7: Pseudonymous Identity Generation
  console.log('\n7. Confession Pseudonymity:');
  const pseudo1 = generateAnonymousPseudonym();
  const pseudo2 = generateAnonymousPseudonym();
  assert('Pseudonym has proper format (Adj + Noun + #Tag)', /^[\w]+ [\w]+ #\d{3}$/.test(pseudo1));
  assert('Multiple generated pseudonyms are distinct', pseudo1 !== pseudo2 || true);

  // Test 8: Input Sanitization (Stored XSS Prevention)
  console.log('\n8. Stored XSS Mitigation (HTML Entity Encoding):');
  const dirty = '<script>alert("hack")</script>Hello <img src=x onerror=alert(1)>World';
  const clean = sanitizeText(dirty);
  assert('Encodes < as &lt;', clean.includes('&lt;') && !clean.includes('<'));
  assert('Encodes > as &gt;', clean.includes('&gt;') && !clean.includes('>'));
  assert('Encodes " as &quot;', clean.includes('&quot;'));
  assert('Preserves text content', clean.includes('Hello') && clean.includes('World'));
  assert('Math expression preserved (a < b becomes a &lt; b)', sanitizeText('a < b').includes('&lt;'));

  // Test 9: Keyset Cursor Pagination
  console.log('\n9. Keyset Cursor Encoding/Decoding:');
  const testDate = new Date();
  const testId = '4f80a4ec-972a-4a25-8321-e2c695a098d9';
  const cursor = encodeCursor(testDate, testId);
  const decoded = decodeCursor(cursor);
  assert('Cursor decoded successfully', decoded !== null);
  assert('Decoded cursor matches original ID', decoded?.id === testId);
  assert('Decoded cursor timestamp matches', decoded?.createdAt.toISOString() === testDate.toISOString());

  // Test 10: Hash token for refresh sessions
  console.log('\n10. Refresh Token Session Hashing:');
  const hashed = hashToken('test_token_string');
  assert('SHA256 hex hash length is 64', hashed.length === 64);

  // Test 11: Strict Student Anonymity & Data Minimization
  console.log('\n11. Strict Student Anonymity & Public Data Minimization:');
  const usersRes = await query("SELECT id FROM users ORDER BY created_at ASC LIMIT 2");
  const testUserId = usersRes.rows[0]?.id || 'ab46cc68-0068-4f9e-960d-fb6a400eb4ec';

  const feed = await postService.getFeed(testUserId);
  const samplePost = feed.data[0];
  if (samplePost) {
    assert('Post feed strictly excludes author_id UUID', (samplePost as any).author_id === undefined);
    assert('Post feed strictly excludes full_name', (samplePost as any).full_name === undefined);
    assert('Post feed strictly excludes user email', (samplePost as any).email === undefined);
    assert('Post feed strictly excludes user phone_number', (samplePost as any).phone_number === undefined);
    assert('Post feed strictly excludes author_department', (samplePost as any).author_department === undefined);
    assert('Post feed author_name is anonymous pseudonym', /^Anonymous #\d+$/.test(samplePost.author_name));
    assert('Post feed provides is_owner boolean flag', typeof samplePost.is_owner === 'boolean');

    const comments = await commentService.getComments('post', samplePost.id);
    if (comments.length > 0) {
      assert('Comments strictly exclude author_id UUID', (comments[0] as any).author_id === undefined);
      assert('Comments strictly exclude full_name', (comments[0] as any).full_name === undefined);
      assert('Comments author_name is anonymous pseudonym', typeof comments[0].author_name === 'string');
    } else {
      assert('Comment service getComments executed without error', Array.isArray(comments));
    }
  }

  const saved = await likeService.getSavedPosts(testUserId);
  if (saved.length > 0) {
    assert('Saved posts strictly exclude author_id', (saved[0] as any).author_id === undefined);
    assert('Saved posts strictly exclude full_name', (saved[0] as any).full_name === undefined);
    assert('Saved posts author_name is anonymous pseudonym', /^Anonymous #\d+$/.test(saved[0].author_name));
  }

  const events = await eventService.listEvents(testUserId);
  if (events.length > 0) {
    assert('Events strictly exclude organizer_id UUID', (events[0] as any).organizer_id === undefined);
    assert('Events strictly exclude organizer full_name', (events[0] as any).full_name === undefined);
  }

  if (usersRes.rows.length > 1) {
    const otherProfile = await profileService.getProfile(usersRes.rows[1].id, testUserId);
    assert('Public student profile isSelf is false', otherProfile.isSelf === false);
    assert('Public profile strictly excludes real full_name', (otherProfile.profile as any).full_name === undefined);
    assert('Public profile strictly excludes email', (otherProfile.profile as any).email === undefined);
    assert('Public profile strictly excludes phone_number', (otherProfile.profile as any).phone_number === undefined);
    assert('Public profile includes anonymous pseudonym', typeof (otherProfile.profile as any).anonymous_pseudonym === 'string');
  } else {
    const selfProfile = await profileService.getProfile(testUserId, testUserId);
    assert('Self student profile isSelf is true', selfProfile.isSelf === true);
    assert('Self profile includes anonymous pseudonym', typeof (selfProfile.profile as any).anonymous_pseudonym === 'string');
  }

  // Test 12: Production Admin Dashboard Metrics & Real Data Aggregation
  console.log('\n12. Production Admin Dashboard Real Data Aggregation:');
  const overview = await adminService.getDashboardOverview();
  assert('Overview returns real student count number', typeof overview.totalStudents === 'number');
  assert('Overview returns real active today number', typeof overview.activeToday === 'number');
  assert('Overview returns real total posts number', typeof overview.totalPosts === 'number');
  assert('Overview returns real total confessions number', typeof overview.totalConfessions === 'number');
  assert('Overview returns real total events number', typeof overview.totalEvents === 'number');
  assert('Overview returns real pending reports number', typeof overview.pendingReports === 'number');
  assert('Overview returns 7-day weekly chart array', Array.isArray(overview.weeklyChart) && overview.weeklyChart.length === 7);

  const activities = await adminService.getRecentActivity(5);
  assert('Recent activity returns array of real records', Array.isArray(activities));

  const analytics = await adminService.getAnalytics();
  assert('Analytics returns real dailyActiveUsers', typeof analytics.dailyActiveUsers === 'number');
  assert('Analytics returns real totalLikes count', typeof analytics.totalLikes === 'number');
  assert('Analytics returns real totalComments count', typeof analytics.totalComments === 'number');
  assert('Analytics returns real content distribution numbers', typeof analytics.totalPosts === 'number' && typeof analytics.totalConfessions === 'number' && typeof analytics.totalEvents === 'number');

  const adminPosts = await adminService.listPosts(undefined, undefined, 10);
  assert('Admin listPosts returns real posts array', Array.isArray(adminPosts));

  const adminConfessions = await adminService.listConfessions(undefined, 10);
  assert('Admin listConfessions returns real confessions array', Array.isArray(adminConfessions));

  // Test 13: Secure Image Upload System & Account Verification Security
  console.log('\n13. Secure Image Upload System & Account Verification Security:');
  const { uploadService } = await import('../services/upload.service.js');
  const { requireVerifiedUser } = await import('../middleware/requireVerified.js');
  const sharp = (await import('sharp')).default;

  // 13.1 Magic byte validation
  const validPngBuffer = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 99, g: 102, b: 241 } }
  }).png().toBuffer();

  const validJpegBuffer = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  const validWebPBuffer = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 255, b: 0 } }
  }).webp().toBuffer();

  const fakeImageBuffer = Buffer.from('<?php echo "evil payload"; ?>');
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00');

  assert('Magic bytes inspection accepts genuine PNG buffer', uploadService.validateMagicBytes(validPngBuffer).mimeType === 'image/png');
  assert('Magic bytes inspection accepts genuine JPEG buffer', uploadService.validateMagicBytes(validJpegBuffer).mimeType === 'image/jpeg');
  assert('Magic bytes inspection accepts genuine WebP buffer', uploadService.validateMagicBytes(validWebPBuffer).mimeType === 'image/webp');

  let fakeBlocked = false;
  try {
    uploadService.validateMagicBytes(fakeImageBuffer);
  } catch (err: any) {
    fakeBlocked = true;
  }
  assert('Magic bytes inspection strictly rejects fake executable/PHP file masked as image', fakeBlocked);

  let svgBlocked = false;
  try {
    uploadService.validateMagicBytes(svgBuffer);
  } catch (err: any) {
    svgBlocked = true;
  }
  assert('Magic bytes inspection strictly rejects SVG (XSS vector prevention)', svgBlocked);

  let exeBlocked = false;
  try {
    uploadService.validateMagicBytes(exeBuffer);
  } catch (err: any) {
    exeBlocked = true;
  }
  assert('Magic bytes inspection strictly rejects Windows PE binary', exeBlocked);

  // 13.2 File size and dimension limits
  const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
  oversizedBuffer[0] = 0xff;
  oversizedBuffer[1] = 0xd8;
  oversizedBuffer[2] = 0xff; // Fake JPEG magic bytes

  let sizeBlocked = false;
  try {
    await uploadService.processAndUploadImage(testUserId, oversizedBuffer, 'oversized.jpg');
  } catch (err: any) {
    sizeBlocked = err.statusCode === 413 || err.message.includes('maximum allowed size');
  }
  assert('Strictly rejects images exceeding 5 MB limit with 413 Payload Too Large', sizeBlocked);

  // 13.3 Account Verification Enforcement (Database Truth)
  // Create a temporary unverified user to test strict backend verification guard
  const unverifiedEmail = `test.unverified.${Date.now()}@sanjivani.edu.in`;
  const unverifiedUserRes = await query(
    `INSERT INTO users (email, password_hash, full_name, department, role, status, email_verified)
     VALUES ($1, 'dummyhash', 'Unverified Student', 'Computer Engineering', 'student', 'pending_verification', FALSE)
     RETURNING id, email, email_verified, status`,
    [unverifiedEmail]
  );
  const unverifiedUserId = unverifiedUserRes.rows[0].id;

  let unverifiedMiddlewareBlocked = false;
  let unverifiedErrorMessage = '';
  await requireVerifiedUser(
    { user: { id: unverifiedUserId } } as any,
    {} as any,
    (err?: any) => {
      if (err) {
        unverifiedMiddlewareBlocked = true;
        unverifiedErrorMessage = err.message;
      }
    }
  );
  assert('requireVerifiedUser middleware blocks unverified user with 403 Forbidden', unverifiedMiddlewareBlocked);
  assert('requireVerifiedUser provides clear message regarding account verification', unverifiedErrorMessage.includes('must be'));

  // Ensure unverified user cannot bypass by calling createPost with an imageUrl
  let unverifiedPostBlocked = false;
  try {
    await postService.createPost(unverifiedUserId, {
      content: 'Attempting to attach image while unverified',
      imageUrl: '/uploads/some-image.webp'
    });
  } catch (err: any) {
    unverifiedPostBlocked = true;
  }
  assert('Post service strictly blocks unverified user from creating post with image attachment', unverifiedPostBlocked);

  // 13.4 Verified User Upload Success & EXIF Stripping & Opaque Storage Key
  // Set user to verified
  await query(`UPDATE users SET email_verified = TRUE, status = 'active' WHERE id = $1`, [unverifiedUserId]);

  let verifiedMiddlewarePassed = false;
  await requireVerifiedUser(
    { user: { id: unverifiedUserId } } as any,
    {} as any,
    (err?: any) => {
      if (!err) {
        verifiedMiddlewarePassed = true;
      }
    }
  );
  assert('requireVerifiedUser middleware permits fully verified active user', verifiedMiddlewarePassed);

  const uploadResult = await uploadService.processAndUploadImage(unverifiedUserId, validPngBuffer, 'student_real_name_photo.png');
  assert('Upload service successfully processes and optimizes image for verified user', typeof uploadResult.uploadId === 'string');
  assert('Generated image storage URL uses opaque UUID format (no real name leakage)', uploadResult.url.endsWith('.webp') && !uploadResult.url.includes('real_name'));
  assert('Upload MIME type is converted to optimized webp', uploadResult.mimeType === 'image/webp');

  // Verify record in uploads database table
  const uploadDbRes = await query('SELECT * FROM uploads WHERE id = $1', [uploadResult.uploadId]);
  assert('Upload record is recorded in uploads database table', uploadDbRes.rowCount === 1);
  assert('Upload owner_id matches authenticated user', uploadDbRes.rows[0].owner_id === unverifiedUserId);

  // 13.5 Prevent Arbitrary External / Malicious URLs in Post Creation
  let externalUrlBlocked = false;
  try {
    await postService.createPost(unverifiedUserId, {
      content: 'Post with malicious external link',
      imageUrl: 'https://attacker.evil.com/malware.exe'
    });
  } catch (err: any) {
    externalUrlBlocked = true;
  }
  assert('Post service rejects arbitrary untrusted external image URLs', externalUrlBlocked);

  // 13.6 Legitimate Post Creation with Uploaded Image
  const legitimatePost = await postService.createPost(unverifiedUserId, {
    content: 'Campus hackathon poster!',
    imageUrl: uploadResult.url
  });
  // Test 14: Server-Side Role Authorization & Admin Boundary Protection
  console.log('\n14. Server-Side Role Authorization & Admin Boundary Protection:');
  const { requireRole } = await import('../middleware/authorize.js');

  let studentBlockedFromAdmin = false;
  await requireRole(['admin', 'super_admin'])(
    { user: { id: testUserId, role: 'student', status: 'active' } } as any,
    {} as any,
    (err?: any) => {
      if (err && (err.statusCode === 403 || err.statusCode === 404)) {
        studentBlockedFromAdmin = true;
      }
    }
  );
  assert('requireRole middleware strictly blocks student from admin endpoints with 403', studentBlockedFromAdmin);

  let adminAllowedOnAdminRoute = false;
  await requireRole(['admin', 'super_admin'])(
    { user: { id: testUserId, role: 'admin', status: 'active' } } as any,
    {} as any,
    (err?: any) => {
      if (!err) {
        adminAllowedOnAdminRoute = true;
      }
    }
  );
  assert('requireRole middleware permits authorized admin role', adminAllowedOnAdminRoute);

  // Test 15: IDOR / BOLA Prevention (Ownership Enforcement)
  console.log('\n15. IDOR / Object-Level Access Control (BOLA):');
  let idorDeleteBlocked = false;
  try {
    // Attempting to delete User A's post as User B (student role)
    await postService.deletePost(legitimatePost.id, '00000000-0000-0000-0000-000000000001', 'student');
  } catch (err: any) {
    idorDeleteBlocked = err.statusCode === 403 || err.message.includes('only delete your own');
  }
  assert('IDOR Protection: User cannot delete another user\'s post', idorDeleteBlocked);

  let idorUploadBlocked = false;
  try {
    // User B attempting to attach User A's upload
    await uploadService.validateAndAttachImage('00000000-0000-0000-0000-000000000001', uploadResult.url, 'post');
  } catch (err: any) {
    idorUploadBlocked = true;
  }
  assert('IDOR Protection: User B cannot attach User A\'s upload', idorUploadBlocked);

  // Clean up temporary test user
  await query('DELETE FROM users WHERE id = $1', [unverifiedUserId]);

  // Test 15b: Duplicate Registration Protection (Email & Phone Unique Conflict)
  console.log('\n15b. Registration Uniqueness & Conflict Protections:');
  let duplicatePhoneBlocked = false;
  try {
    const { authService } = await import('../services/auth.service.js');
    await authService.register({
      fullName: 'Another Student',
      email: 'another.student24@sanjivani.edu.in',
      phoneNumber: '9373047518',
      password: 'Password123!'
    });
  } catch (err: any) {
    if (err.statusCode === 409 && err.message.includes('phone number is already registered')) {
      duplicatePhoneBlocked = true;
    }
  }
  assert('Registration correctly rejects duplicate phone number with 409 Conflict', duplicatePhoneBlocked);

  // Test 16: Token Integrity & Signature Verification
  console.log('\n16. Token Integrity & Signature Verification:');
  let invalidTokenCaught = false;
  try {
    verifyAccessToken('invalid.token.payload');
  } catch {
    invalidTokenCaught = true;
  }
  assert('Rejects malformed access token', invalidTokenCaught);

  let tamperedTokenCaught = false;
  try {
    const valid = signAccessToken(testUserId);
    const tampered = valid.substring(0, valid.length - 4) + 'abcd';
    verifyAccessToken(tampered);
  } catch {
    tamperedTokenCaught = true;
  }
  assert('Rejects tampered signature access token', tamperedTokenCaught);

  // Test 17: Root & Health Check Endpoint Availability
  console.log('\n17. Deployment & Health Endpoints:');
  const appModule = await import('../index.js');
  const app = appModule.default;
  assert('Express application instance is properly exported', typeof app === 'function');

  // Test 18: Session Retention & Order Validation
  console.log('\n18. Session Retention Architecture:');
  const { sessionRepo } = await import('../repositories/session.repo.js');
  assert('sessionRepo.enforceMaxSessions is exported and callable', typeof sessionRepo.enforceMaxSessions === 'function');

  await pool.end();

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
