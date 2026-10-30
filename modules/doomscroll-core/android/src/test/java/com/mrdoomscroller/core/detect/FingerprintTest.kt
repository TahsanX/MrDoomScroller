package com.mrdoomscroller.core.detect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The fingerprint must stay identical for one reel while everything that changes on
 * screen during playback changes, and must differ between reels. Each case here is
 * something that would otherwise double-count.
 */
class FingerprintTest {

  private val reelA = listOf("some.creator", "Like. 12.4K likes.", "Comment", "Share", "Original audio", "sunset at the pier #travel")

  @Test
  fun `like counts ticking up do not change the identity`() {
    val later = reelA.map { if (it.startsWith("Like.")) "Like. 12.5K likes." else it }
    assertEquals(Fingerprint.of(reelA), Fingerprint.of(later))
  }

  @Test
  fun `tapping like does not change the identity`() {
    val liked = reelA.map { if (it.startsWith("Like.")) "Unlike. 12.5K likes." else it }
    assertEquals(Fingerprint.of(reelA), Fingerprint.of(liked))
  }

  @Test
  fun `relative timestamps do not change the identity`() {
    val a = listOf("@creator", "great dog video", "2 days ago")
    val b = listOf("@creator", "great dog video", "3 days ago")
    assertEquals(Fingerprint.of(a), Fingerprint.of(b))
  }

  @Test
  fun `label order does not matter`() {
    assertEquals(Fingerprint.of(reelA), Fingerprint.of(reelA.reversed()))
  }

  @Test
  fun `different creators give different identities`() {
    val reelB = reelA.map { if (it == "some.creator") "another.creator" else it }
    assertNotEquals(Fingerprint.of(reelA), Fingerprint.of(reelB))
  }

  @Test
  fun `a page of nothing but controls has no identity`() {
    assertNull(Fingerprint.of(listOf("Like", "Comment", "Share", "1.2M", "Original audio", "More options")))
  }

  @Test
  fun `bangla words keep their vowel signs`() {
    // The vowel signs are combining marks; splitting on them would shred the word.
    assertEquals(listOf("আজকের", "সূর্যাস্ত"), Fingerprint.tokens("আজকের সূর্যাস্ত"))
  }

  @Test
  fun `bangla like counts changing do not change the identity`() {
    val a = listOf("@creator", "আজকের সূর্যাস্ত", "১২ হাজার")
    val b = listOf("@creator", "আজকের সূর্যাস্ত", "১ লাখ")
    assertEquals(Fingerprint.of(a), Fingerprint.of(b))
  }

  @Test
  fun `digits are removed and handles survive as one token`() {
    assertEquals(listOf("@some.user", "likes"), Fingerprint.tokens("@some.user 12,345 likes"))
  }
}
