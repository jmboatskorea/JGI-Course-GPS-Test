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

    def generate_strategy(self):
        self.page.evaluate("JGI_TOURNAMENT_PREVIEW.open()")
        self.page.select_option("#tsTee", CANDIDATE)
        self.page.click("#tsGenerate")

    def test_tournament_18_plans_par_logic_and_no_writes(self):
        before = self.page.evaluate("({store:JSON.stringify(localStorage),profile:JSON.stringify(PARK_JIEUN_PROFILE),gi:JSON.stringify(JGI_ORA_SOUTH_LEFT_DATA)})")
        self.generate_strategy()
        data = self.page.evaluate("""() => {
          const s=JGI_TOURNAMENT_PREVIEW.getStrategy();
          return {count:s.holes.length,holes:s.holes.map(h=>({hole:h.hole,par:h.par,
            hasPlans:!!h.planA&&!!h.planB,distinct:h.planA.club!==h.planB.club||h.planA.target!==h.planB.target,
            landing:h.planA.landing.distanceM,remaining:h.planA.remainingM,
            front:h.greenRange.frontM,center:h.greenRange.centerM,back:h.greenRange.backM,
            second:h.planA.second?.club,third:h.planA.second?.remainingM,preferred:h.planA.preferredThird?.distanceM,
            width:h.planA.landing.widthM,comparison:h.comparison,confidence:h.planA.confidence})),
            store:JSON.stringify(localStorage),profile:JSON.stringify(PARK_JIEUN_PROFILE),gi:JSON.stringify(JGI_ORA_SOUTH_LEFT_DATA)};
        }""")
        self.assertEqual(data["count"], 18)
        self.assertEqual((before["store"],before["profile"],before["gi"]),(data["store"],data["profile"],data["gi"]))
        for h in data["holes"]:
            self.assertTrue(h["hasPlans"] and h["distinct"])
            self.assertGreater(h["landing"], 0)
            self.assertGreaterEqual(h["remaining"], 0)
            if h["par"] == 3:
                self.assertIsInstance(h["front"], (float,int))
                self.assertIsInstance(h["back"], (float,int))
            if h["par"] == 4:
                self.assertIsInstance(h["comparison"]["safetyGain"], (float,int))
                self.assertIsInstance(h["comparison"]["remainingCostM"], (float,int))
            if h["par"] == 5:
                self.assertTrue(h["second"])
                self.assertGreater(h["third"], 0)
                self.assertGreater(h["preferred"], 0)
        self.assertIsNone(data["holes"][17]["width"])
        self.assertEqual(self.page.locator("#tsQuick tbody tr").count(), 18)

    def test_tournament_recent_observation_quality(self):
        data = self.page.evaluate("""() => {
          const good={club:'DR',distanceM:220,direction:'LEFT',depth:'LONG',startLie:'TEE',
            positionSource:{start:'GPS',end:'GPS'},start:{accuracy:3},end:{accuracy:4},editHistory:[]};
          const r={id:'r-quality',playerProfileId:PARK_JIEUN_PROFILE.id,holes:[{shots:[good,
            {...good,end:{accuracy:40}},{...good,editHistory:[{type:'ROUND_EDIT'}]},
            {...good,positionSource:{start:'GPS',end:'MANUAL_EDIT'}},
            {...good,start:{accuracy:null}},{...good,distanceM:999}]}]};
          const before=JSON.stringify(PARK_JIEUN_PROFILE);
          const observation=JGI_TOURNAMENT_STRATEGY.observations(PARK_JIEUN_PROFILE,[r]);
          return {observation,unchanged:before===JSON.stringify(PARK_JIEUN_PROFILE)};
        }""")
        self.assertTrue(data["unchanged"])
        self.assertEqual(data["observation"]["DR"]["count"], 1)
        self.assertEqual(data["observation"]["DR"]["observedDistanceM"], 220)
        self.assertEqual(data["observation"]["DR"]["confidence"], "LOW")
        self.assertNotIn("carry", data["observation"]["DR"])

    def test_tournament_real_player_selection_and_distance_separation(self):
        self.page.evaluate("""() => {
          const p={id:'real-player-b',name:'Player B',handicap:12,
            clubs:PARK_JIEUN_PROFILE.clubs.map(c=>({...c,carry:c.carry*1.3,carryMin:c.carryMin?c.carryMin*1.3:null,carryMax:c.carryMax?c.carryMax*1.3:null}))};
          localStorage.setItem(COMPLETED_ROUNDS_KEY,JSON.stringify([{id:'b-round',playerProfileId:p.id,
            playerName:p.name,playerHandicap:p.handicap,clubProfile:p.clubs,missProfile:{driver:'RIGHT'},holes:[]}]));
        }""")
        self.generate_strategy()
        first = self.page.evaluate("JGI_TOURNAMENT_PREVIEW.getStrategy().holes[0].planA.landing.distanceM")
        self.page.select_option("#tsPlayer", "real-player-b")
        self.page.click("#tsGenerate")
        second = self.page.evaluate("JGI_TOURNAMENT_PREVIEW.getStrategy().holes[0].planA.landing.distanceM")
        self.assertNotEqual(first, second)
        self.page.fill("#tsOfficial", "340")
        self.page.locator("#tsOfficial").blur()
        data = self.page.evaluate("""() => {const h=JGI_TOURNAMENT_PREVIEW.getStrategy().holes[0];
          return {official:h.officialDistanceM,scorecard:h.scorecardDistanceM,gps:h.gpsDistanceM,source:h.distanceSource};}""")
        self.assertEqual(data["official"], 340)
        self.assertEqual(data["scorecard"], 302.67)
        self.assertNotEqual(data["official"], data["gps"])
        self.assertEqual(data["source"], "USER_SUPPLIED_OFFICIAL")

    def test_tournament_missing_geometry_remains_unavailable(self):
        data = self.page.evaluate("""() => {
          const course={...JGI_ORA_SOUTH_LEFT_DATA,holes:{...JGI_ORA_SOUTH_LEFT_DATA.holes}};
          course.holes['1']={...course.holes['1'],s:[],localS:[]};
          const s=JGI_TOURNAMENT_STRATEGY.calculate({course,scorecard:oraCandidateScorecard,
            player:PARK_JIEUN_PROFILE,tee:'Tournament Tee Candidate · Regular'},
            {shapes:courseShapes,model:buildCourseIntelligenceModel,projector:courseLocalProjector,
              distance:hav,shapeDistance:distanceToShapeXY,side:riskSide,section:projectedLandingSection});
          const h=s.holes[0];return {types:h.geometryTypes,width:h.planA.landing.widthM,
            bunker:h.planA.risk.bunker,water:h.planA.risk.water,front:h.greenRange.frontM,mode:h.planA.mode};
        }""")
        self.assertEqual(data, {"types":[],"width":None,"bunker":None,"water":None,"front":None,"mode":"CAUTION"})

    def test_tournament_mobile_navigation(self):
        self.page.set_viewport_size({"width":390,"height":844})
        self.generate_strategy()
        self.assertEqual(self.page.locator("#tsHoles button").count(), 18)
        for n in [2,5,18]:
            self.page.locator(f'#tsHoles button[data-hole="{n}"]').click()
            self.assertIn(f"Hole {n}", self.page.locator("#tsHoleTitle").inner_text())
            self.assertEqual(self.page.locator("#tsPlans article").count(), 2)
        dimensions = self.page.evaluate("({width:innerWidth,scroll:document.getElementById('tournamentStrategy').scrollWidth})")
        self.assertLessEqual(dimensions["scroll"], dimensions["width"])
        self.page.click("#tsClose")
        self.assertFalse(self.page.locator("#tournamentStrategy").is_visible())

    def test_tournament_club_choice_and_recent_layup_reference(self):
        data = self.page.evaluate("""() => {
          const geo={shapes:courseShapes,model:buildCourseIntelligenceModel,projector:courseLocalProjector,
            distance:hav,shapeDistance:distanceToShapeXY,side:riskSide,section:projectedLandingSection};
          const alternate={...PARK_JIEUN_PROFILE,clubs:PARK_JIEUN_PROFILE.clubs.map(c=>c.name==='DR'?{...c,carry:140,carryMin:130,carryMax:150}:c)};
          const a=JGI_TOURNAMENT_STRATEGY.calculate({course:JGI_ORA_SOUTH_LEFT_DATA,scorecard:oraCandidateScorecard,
            player:alternate,tee:'Tournament Tee Candidate · Regular'},geo);
          const recent=Array.from({length:3},(_,i)=>({id:'reference-'+i,playerProfileId:PARK_JIEUN_PROFILE.id,
            holes:[{shots:Array.from({length:2},()=>({club:'6I',distanceM:137,shotIntent:'GREEN_ATTACK',startLie:'FAIRWAY',
              direction:'LEFT',positionSource:{start:'GPS',end:'GPS'},start:{accuracy:3},end:{accuracy:3},editHistory:[]}))}]}));
          const b=JGI_TOURNAMENT_STRATEGY.calculate({course:JGI_ORA_SOUTH_LEFT_DATA,scorecard:oraCandidateScorecard,
            player:PARK_JIEUN_PROFILE,rounds:recent,tee:'Tournament Tee Candidate · Regular'},geo);
          return {nonDriver:a.holes.some(h=>h.par===4&&h.planA.club!=='DR'),
            preferred:b.holes[6].planA.preferredThird,second:b.holes[6].planA.second.club,
            rawCarry:PARK_JIEUN_PROFILE.clubs.find(c=>c.name==='6I').carry,observed:b.recent['6I'].observedDistanceM};
        }""")
        self.assertTrue(data["nonDriver"])
        self.assertEqual(data["preferred"]["distanceM"], 125)
        self.assertEqual(data["rawCarry"], 125)
        self.assertEqual(data["observed"], 137)
        self.assertNotEqual(data["second"], "DR")

    def test_tournament_satellite_orientation_contract(self):
        self.generate_strategy()
        data = self.page.evaluate("""() => {
          const maps=[];class Overlay{constructor(options){this.options=options}setMap(){}}
          class MapDouble{constructor(node,options){this.options=options;this.heading=0;maps.push(this)}
            fitBounds(){}setHeading(value){this.heading=value}getHeading(){return this.heading}setTilt(value){this.tilt=value}addListener(){}}
          class Bounds{extend(){return this}}
          window.google={maps:{Map:MapDouble,Marker:Overlay,Polyline:Overlay,Polygon:Overlay,
            LatLngBounds:Bounds,RenderingType:{VECTOR:'VECTOR'},SymbolPath:{CIRCLE:'CIRCLE'},
            event:{addListenerOnce:(map,name,cb)=>{if(name==='idle')cb()}}}};
          document.querySelector('#tsHoles button[data-hole="5"]').click();
          const h=JGI_TOURNAMENT_PREVIEW.getStrategy().holes[4].sourceGeometry;
          return {type:maps[0].options.mapTypeId,heading:maps[0].heading,
            expected:bearingDeg({lat:h.t[0],lng:h.t[1]},{lat:h.g[0],lng:h.g[1]}),tilt:maps[0].tilt,
            locked:maps[0].options.headingInteractionEnabled===false};
        }""")
        self.assertEqual(data["type"], "satellite")
        self.assertAlmostEqual(data["heading"], data["expected"])
        self.assertEqual(data["tilt"], 0)
        self.assertTrue(data["locked"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
