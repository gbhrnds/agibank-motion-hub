import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "helpers"))
import fillers  # noqa: E402
import render  # noqa: E402


def w(text, start, end):
    return {"text": text, "start": start, "end": end}


TAKE = [
    w("Então", 0.5, 0.8), w("é...", 1.2, 1.9), w("eu", 2.2, 2.3), w("eu", 2.35, 2.45),
    w("acho", 2.5, 2.8), w("que", 2.82, 2.9), w("hum", 3.3, 3.6), w("a", 3.9, 3.95),
    w("gente", 3.97, 4.2), w("cresce,", 4.25, 4.6), w("né?", 4.62, 4.8),
    w("O", 6.5, 6.6), w("Agibank", 6.62, 7.1), w("é", 7.12, 7.2), w("legal.", 7.22, 7.6),
]


class ClassifyTests(unittest.TestCase):
    def cut(self, words, aggressive=False):
        reasons = fillers.classify(words, aggressive, 0.25)
        return [x["text"] for x, r in zip(words, reasons) if r]

    def test_real_take(self):
        self.assertEqual(self.cut(TAKE), ["Então", "é...", "eu", "hum"])

    def test_verb_e_is_kept(self):
        # "é" inside a sentence is the verb, not a filler.
        self.assertNotIn("é", self.cut(TAKE))

    def test_aggressive_cuts_tag_question(self):
        self.assertIn("né?", self.cut(TAKE, aggressive=True))

    def test_two_word_repeat(self):
        words = [w("a", 0, 0.1), w("gente", 0.12, 0.4), w("a", 0.5, 0.6), w("gente", 0.62, 0.9), w("vai", 0.92, 1.2)]
        self.assertEqual(self.cut(words), ["a", "gente"])

    def test_truncated_word(self):
        self.assertEqual(self.cut([w("pro-", 0, 0.2), w("produto", 0.3, 0.8)]), ["pro-"])


class RangeTests(unittest.TestCase):
    def test_edges_on_word_boundaries(self):
        reasons = fillers.classify(TAKE, False, 0.25)
        ranges = fillers.build_ranges(TAKE, reasons, 0.5)
        self.assertEqual([r["quote"] for r in ranges],
                         ["eu acho que", "a gente cresce, né?", "O Agibank é legal."])
        # The kept "eu" starts at 2.35: the cut "eu" before it ends at 2.30, so the
        # padded start may not reach back into it.
        self.assertGreaterEqual(ranges[0]["start"], 2.30)
        for r in ranges:
            self.assertLess(r["start"], r["end"])


class CaptionTests(unittest.TestCase):
    def test_sentence_tail_not_orphaned(self):
        words = [{"type": "word", **x} for x in
                 [w("O", 0, .1), w("Agibank", .12, .5), w("cresce", .52, .8), w("com", .82, 1), w("você.", 1.02, 1.4)]]
        chunks = render.chunk_words(words, 4)
        self.assertEqual([" ".join(x["text"] for x in c) for c in chunks], ["O Agibank cresce com você."])


if __name__ == "__main__":
    unittest.main()
