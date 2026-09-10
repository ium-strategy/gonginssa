# 자동 썸네일 아이콘 드롭인 폴더

`thumb_gen.py`가 그리는 기본 아이콘(플랫 벡터)을 실사진·3D 렌더 아이콘으로 교체하고
싶으면, 이 폴더에 `<key>.png`(정사각형, 배경 투명 PNG 권장)를 넣으면 된다. 코드 수정은
필요 없다 — 빌드 시 해당 키의 파일이 있으면 그걸 그대로 쓰고, 없으면 기본 아이콘을 그린다.

키 목록(`thumb_gen.ICON_LIBRARY` 참고): `ai`, `megaphone`, `camera`, `people`,
`calendar`, `video`, `chart`, `trophy`, `doc`
