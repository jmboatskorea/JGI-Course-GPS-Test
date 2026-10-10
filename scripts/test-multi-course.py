"""Browser regression checks. Uses installed Playwright and Chromium; installs nothing.

Run from the checkout: python3 scripts/test-multi-course.py
Satellite overlay checks use a Maps API double, not live Google satellite imagery.
"""
import functools
import http.server
import json
import shutil
import subprocess
import threading
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = "b04472281e8f89d7992aa38be67110a3d10511f6"
JAG = "Jagorawi Golf & Country Club"
ORA = "Ora Country Club"
CANDIDATE = "Tournament Tee Candidate · Regular"

SNAPSHOT = """() => {
  tee='Red';round=emptyRound('Jagorawi Golf & Country Club','Old Course');
  return {
    truth:round.courseTruth,
    holes:round.holes.map(h=>{
      round.currentHole=h.hole;const data=courseHoleData();
      return {hole:h.hole,par:h.par,distance:h.teeDistanceM,si:h.strokeIndexLadies,
        shapes:courseShapes(data),
        intelligence:deriveCourseIntelligence(data,{lat:data.t[0],lng:data.t[1]},180,null,h.par),
        target:targetZonePointForShot(data,{lat:data.t[0],lng:data.t[1]},180,'CENTER',h.par)};
    }),
    scorecards:['Blue','White','Red'].map(t=>Array.from({length:18},(_,i)=>scorecardHoleData(i+1,t))),
    sg:['TEE','FAIRWAY','ROUGH','BUNKER','GREEN'].map(l=>[1,5,50,100,150,200].map(d=>sgExpected(d,l)))
  };
}"""


class MultiCourse(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
        )
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/index.html"
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(
            executable_path=shutil.which("chromium"), headless=True, args=["--no-sandbox"]
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(
            permissions=["geolocation"], geolocation={"latitude":33.444,"longitude":126.513,"accuracy":3}
        )
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.on("dialog", lambda d: d.accept())
        # No key or network is required for these local regression checks.
        self.page.route("https://maps.googleapis.com/**", lambda r: r.abort())
        self.page.goto(self.url, wait_until="domcontentloaded")

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.context.close()

    def select_ora(self, candidate=CANDIDATE):
        self.page.click("#enterRoundBtn")
        self.page.select_option("#courseSelect", ORA)
        self.page.select_option("#oraTeeSelect", candidate)
        self.page.evaluate("startRoundWithCondition()")

    def test_jagorawi_matches_original_commit(self):
        current = self.page.evaluate(SNAPSHOT)
        original = subprocess.check_output(["git", "show", f"{BASE}:index.html"], cwd=ROOT).decode()
        self.page.route(self.url, lambda r: r.fulfill(status=200, content_type="text/html", body=original))
        self.page.reload(wait_until="domcontentloaded")
        self.assertEqual(current, self.page.evaluate(SNAPSHOT))

    def test_candidate_requires_explicit_selection(self):
        self.page.click("#enterRoundBtn")
        self.page.select_option("#courseSelect", ORA)
        self.assertEqual(self.page.evaluate("tee"), "")
        self.assertFalse(self.page.locator("#teeSegment").is_visible())
        options = self.page.locator("#oraTeeSelect option").all_text_contents()
        self.assertEqual(len(options), 5)
        self.assertTrue(all("Tournament Tee Candidate" in o for o in options))
        self.page.click("#startRoundBtn")
        self.assertIsNone(self.page.evaluate("round"))
        self.page.select_option("#oraTeeSelect", CANDIDATE)
        self.page.click("#startRoundBtn")
        self.assertTrue(self.page.locator("#conditionScreen").is_visible())
        self.page.evaluate("startRoundWithCondition()")
        self.assertEqual(self.page.evaluate("round.tee"), CANDIDATE)

    def test_all_ora_tees_scorecard_and_geometry(self):
        result = self.page.evaluate("""() => {
          const raw=window.JGI_ORA_SOUTH_LEFT_SCORECARD_DATA;
          return Object.entries(ORA_TEE_CANDIDATES).map(([alias,candidate])=>{
            tee=candidate;round=emptyRound('Ora Country Club','South Left');
            return {tee:round.tee,par:round.holes.reduce((n,h)=>n+h.par,0),
              holes:round.holes.map(h=>{
                round.currentHole=h.hole;const g=courseHoleData();const sc=raw.holes[h.hole];
                const shapes=courseShapes(g);return {
                  valid:h.teeDistanceM===sc[alias]&&h.par===sc.par&&h.strokeIndexMen===sc.indexMen,
                  id:g.i===g.holeId,types:shapes.map(s=>s.type),
                  paths:JSON.stringify(shapes)===JSON.stringify(g.localS.map(i=>unpackCourseShape(g.s[i]))),
                  green:JSON.stringify(greenEdgePolygonForHole(h.hole))===JSON.stringify(g.localS.map(i=>g.s[i]).find(s=>s[0]==='G')[2])
                };
              })};
          });
        }""")
        self.assertEqual(len(result), 4)
        all_types = set()
        for candidate in result:
            self.assertIn("Tournament Tee Candidate", candidate["tee"])
            self.assertEqual(candidate["par"], 72)
            self.assertEqual(len(candidate["holes"]), 18)
            for hole in candidate["holes"]:
                self.assertTrue(hole["valid"] and hole["id"] and hole["paths"] and hole["green"])
                self.assertIn("GREEN", hole["types"])
                all_types.update(hole["types"])
        self.assertTrue({"FAIRWAY","GREEN","BUNKER","WATER","TEE"}.issubset(all_types))

    def test_switch_shot_gps_state_putt_penalty_sg(self):
        self.select_ora()
        result = self.page.evaluate("""() => {
          const run=(course,nine,t)=>{
            tee=t;round=emptyRound(course,nine);
            const g=courseHoleData();gps={lat:g.t[0],lng:g.t[1],accuracy:3,time:Date.now()};
            startPositionOverride='GPS';beginPending('DR');lockPendingShotStart();
            floDraft={pressure:2,interference:2,tension:2,confidence:4,focus:4,thoughtFocus:null,note:''};
            $('saveFloBtn').onclick();
            const shot=finalizePending({lat:g.t[0]+(g.g[0]-g.t[0])*.6,lng:g.t[1]+(g.g[1]-g.t[1])*.6,source:'GPS'},'FAIRWAY');
            penaltyDraft={type:'HAZARD',strokes:1};$('savePenaltyBtn').onclick();
            puttDraft={distanceM:3,slope:'FLAT',break:'STRAIGHT',result:'SHORT'};
            puttGreenUI.ball={x:180,y:220};$('puttDistanceInput').value='3';$('savePuttBtn').onclick();
            const completed=hole();
            puttDraft={distanceM:.5,slope:'FLAT',break:'STRAIGHT',result:'HOLED'};
            puttGreenUI.ball={x:180,y:190};$('puttDistanceInput').value='.5';$('savePuttBtn').onclick();
            return {courseId:shot.courseContext.courseId,holeId:shot.courseContext.holeId,
              gps:shot.start.source,locked:!!shot.startLockedAt,state:shot.playerState.pressure,
              shots:completed.shots.length,putts:completed.puttsDetail.length,penalties:completed.penalties,
              report:!!completed.review,sg:computeShotSG(completed,shot,0).value,
              puttSg:computePuttSG(completed,completed.puttsDetail[0],0).value,
              restored:JSON.parse(localStorage.getItem(STORAGE)).course};
          };
          return [run('Ora Country Club','South Left','Tournament Tee Candidate · Regular'),
            run('Jagorawi Golf & Country Club','Old Course','Red'),
            run('Ora Country Club','South Left','Tournament Tee Candidate · Front')];
        }""")
        self.assertEqual([r["courseId"] for r in result], [34617,22987,34617])
        for r in result:
            self.assertEqual((r["gps"],r["state"],r["shots"],r["putts"],r["penalties"]),("GPS",2,1,2,1))
            self.assertTrue(r["locked"] and r["holeId"] and r["report"])
            self.assertIsInstance(r["sg"], (int,float))
            self.assertIsInstance(r["puttSg"], (int,float))

    def test_shared_geometry_player_specific_strategy(self):
        self.select_ora()
        result = self.page.evaluate("""() => {
          const before=JSON.stringify(window.JGI_ORA_SOUTH_LEFT_DATA);
          const a=round;const data=activeCourseData(a);const h=data.holes['1'];
          const start={lat:h.t[0],lng:h.t[1]};const model=buildCourseIntelligenceModel(h,4);
          masterClubs=[{name:'DR',carry:180},{name:'7I',carry:115}];targetDistanceM=150;
          const clubsA=recommendedClubs().map(c=>c.name);
          const targetA=targetZonePointForShot(h,start,180,'CENTER',4);
          round=emptyRound('Ora Country Club','South Left');
          masterClubs=[{name:'DR',carry:250},{name:'7I',carry:150}];
          return {sameGeometry:data===activeCourseData(round),sameModel:model===buildCourseIntelligenceModel(h,4),
            clubsA,clubsB:recommendedClubs().map(c=>c.name),targetA,
            targetB:targetZonePointForShot(h,start,250,'CENTER',4),
            unchanged:before===JSON.stringify(window.JGI_ORA_SOUTH_LEFT_DATA),
            keyed:[...courseIntelligenceCache.keys()].some(k=>k.startsWith('34617|GI_ORA_SOUTH_LEFT_2026_10_09_V1|'))};
        }""")
        self.assertTrue(result["sameGeometry"] and result["sameModel"] and result["unchanged"] and result["keyed"])
        self.assertNotEqual(result["clubsA"], result["clubsB"])
        self.assertNotEqual(result["targetA"], result["targetB"])

    def test_satellite_overlay_contract_and_cleanup(self):
        self.select_ora()
        result = self.page.evaluate("""() => {
          const overlays=[];class Overlay{constructor(options){this.options=options;overlays.push(this)}setMap(map){this.map=map}}
          window.google={maps:{Polygon:Overlay,Polyline:Overlay}};googleMap={};
          renderJgiCourseView=renderCurrentHoleFocusMask=renderCenterCorridorOverlay=fitCurrentHole=updateMapFirstGreenMarker=syncMapFirstDistance=()=>{};
          renderCourseHole();const first=courseOverlays.slice();
          const shapes=courseShapes(courseHoleData()).filter(s=>s.type!=='HOLE_BOUNDARY');
          const same=JSON.stringify(first.map(o=>o.options.paths||o.options.path))===JSON.stringify(shapes.map(s=>s.path));
          round.currentHole=18;renderCourseHole();
          const changed=first.every(o=>o.map===null)&&courseOverlays.length>0;
          tee='Red';round=emptyRound('Jagorawi Golf & Country Club','Old Course');renderCourseHole();
          return {same,changed,jagorawiUntouched:courseOverlays.length===0};
        }""")
        self.assertEqual(result, {"same":True,"changed":True,"jagorawiUntouched":True})

    def test_mixed_round_geometry_uses_own_course(self):
        self.select_ora()
        result = self.page.evaluate("""() => {
          const r=emptyRound('Jagorawi Golf & Country Club','Old Course');
          const h=r.holes[0];const g=activeCourseData(r).holes['1'];
          const row={r,h,s:{start:{lat:g.t[0],lng:g.t[1]},end:{lat:g.t[0],lng:g.t[1]}}};
          return teeShotCoordinateForRow(row);
        }""")
        self.assertAlmostEqual(result["xM"], 0)
        self.assertAlmostEqual(result["yM"], 0)

    def test_legacy_ora_round_and_jagorawi_setup(self):
        result = self.page.evaluate("""() => {
          tee='Tournament Tee Candidate · Regular';
          const r=emptyRound('Ora Country Club','South Left');r.tee='Blue';hydrateRoundCourseTruth(r);
          return {tee:r.tee,distance:r.holes[0].teeDistanceM};
        }""")
        self.assertEqual(result, {"tee":CANDIDATE,"distance":302.67})
        self.page.click("#enterRoundBtn")
        self.page.select_option("#courseSelect", ORA)
        self.page.select_option("#oraTeeSelect", CANDIDATE)
        self.page.select_option("#courseSelect", JAG)
        self.assertEqual(self.page.evaluate("tee"), "Red")
        self.assertTrue(self.page.locator("#teeSegment").is_visible())
        self.assertFalse(self.page.locator("#oraTeeField").is_visible())


if __name__ == "__main__":
    unittest.main(verbosity=2)
