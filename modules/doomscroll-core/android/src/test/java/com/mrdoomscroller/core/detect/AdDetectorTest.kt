package com.mrdoomscroller.core.detect

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdDetectorTest {

  @Test
  fun `instagram sponsored description is an ad however long the caption`() {
    assertTrue(AdDetector.isAd(listOf("Sponsored Reel by brand. " + "x".repeat(300))))
  }

  @Test
  fun `youtube ad badge is an ad`() {
    assertTrue(AdDetector.isAd(listOf("Ad", "Some product video")))
  }

  @Test
  fun `facebook sponsored and paid partnership labels are ads`() {
    assertTrue(AdDetector.isAd(listOf("Sponsored · Paid for by X")))
    assertTrue(AdDetector.isAd(listOf("Paid partnership with brand")))
  }

  @Test
  fun `call to action buttons are ads`() {
    assertTrue(AdDetector.isAd(listOf("Shop now")))
    assertTrue(AdDetector.isAd(listOf("Install now")))
  }

  @Test
  fun `a caption mentioning ads is not an ad`() {
    assertFalse(AdDetector.isAd(listOf("this is not an ad, just my dog", "@me")))
  }

  @Test
  fun `a share sheet is not an ad`() {
    // Bare "Download" sits in ordinary share sheets, which is why it is not a CTA.
    assertFalse(AdDetector.isAd(listOf("Download", "Copy link", "Share to")))
  }
}
