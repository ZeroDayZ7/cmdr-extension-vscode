# Lokalny build i pakowanie rozszerzenia CMDR

Ten dokument opisuje codzienny proces przygotowania lokalnej wersji rozszerzenia **CMDR Tools** z repozytorium `cli-helper`.

Proces nie publikuje rozszerzenia w Marketplace i nie zmienia systemowego PATH ani rejestracji CLI.

## 1. Wymagania wstępne

Należy korzystać z następujących narzędzi:

- Node.js,
- npm,
- lokalnie dostępne `vsce`,
- Visual Studio Code.

Sprawdzenie narzędzi:

```powershell
node --version
npm --version
npx vsce --version
```

Do lokalnych testów rozszerzenia projekt domyślnie wykorzystuje istniejącą instalację:

```text
C:\Users\Neo\AppData\Local\Programs\Microsoft VS Code\Code.exe
```

Konfigurację testów znajduje się w `.vscode-test.mjs`. Mechanizm używa `@vscode/test-cli` i `@vscode/test-electron`, uruchamiając osobny proces z tymczasowym profilem użytkownika. Nie powinien pobierać osobnej kopii VS Code.

Jeżeli VS Code znajduje się w innym katalogu, można nadpisać ścieżkę:

```powershell
$env:VSCODE_TEST_EXECUTABLE="C:\pełna\ścieżka\do\Code.exe"
```

Zmienna obowiązuje tylko dla bieżącego terminala.

## 2. Przygotowanie projektu

Przejdź do katalogu projektu:

```powershell
cd C:\Users\Neo\Desktop\WWW\vscode\cli-helper
```

### Pierwsza instalacja lub pełna ponowna instalacja

Użyj:

```powershell
npm ci
```

`npm ci` należy zastosować:

- po pierwszym pobraniu repozytorium,
- po zmianie `package-lock.json`,
- po usunięciu katalogu `node_modules`,
- przy podejrzeniu rozbieżności zależności.

Polecenie zgodnie z lockfile usuwa i odtwarza `node_modules`.

### Zwykła praca dzienna

Jeżeli `node_modules` istnieje i `package.json` oraz `package-lock.json` nie zmieniły się, zwykle nie trzeba ponownie uruchamiać instalacji.

W przypadku aktualizacji zależności należy najpierw zmienić wymagane zależności i zaktualizować lockfile, a następnie uruchomić:

```powershell
npm ci
```

Nie zmieniaj ręcznie wpisów nazwy projektu lub wersji w `package.json` i `package-lock.json`. Są one generowane na podstawie:

- `metadata/project.json` — nazwa techniczna, nazwa wyświetlana i wersja,
- `package.template.json` — pozostałe metadane,
- `metadata/menus.json` — komendy i menu.

## 3. Lokalna kontrola jakości

Rekomendowana kolejność to:

```powershell
npm run gen-manifest
npm run validate:metadata
npm run test:manifest
npm run check-types
npm run lint
npm run compile-tests
npm run compile
npm test
```

### Generowanie i walidacja manifestu

```powershell
npm run gen-manifest
```

Generuje `package.json` z centralnych metadanych i metadanych menu.

```powershell
npm run validate:metadata
```

Weryfikuje zgodność:

- `metadata/project.json`,
- wygenerowanego `package.json`,
- `package-lock.json`.

### Testy generatora manifestu

```powershell
npm run test:manifest
```

Uruchamia testy Node.js dla generatora manifestu i centralnych metadanych.

### Kontrola typów

```powershell
npm run check-types
```

Uruchamia TypeScript bez emitowania plików.

### Lint

```powershell
npm run lint
```

Uruchamia ESLint na katalogu `src`.

### Kompilacja testów i rozszerzenia

```powershell
npm run compile-tests
npm run compile
```

- `compile-tests` kompiluje testy do `out/`.
- `compile` wykonuje kontrolę typów, lint i zwykłą kompilację esbuild.

### Testy VS Code

```powershell
npm test
```

W praktyce `pretest` wykonuje najpierw:

1. testy generatora,
2. kompilację testów,
3. kompilację i lint rozszerzenia.

Następnie `vscode-test` uruchamia rozszerzenie w osobnym procesie VS Code z lokalnego `Code.exe`, jeżeli jest dostępny.

## 4. Produkcyjny build

Produkcjny build projektu:

```powershell
npm run build:prod
```

Proces wykonuje:

1. `prepare:metadata`,
2. `gen-manifest`,
3. synchronizację `package-lock.json`,
4. walidację centralnych metadanych,
5. kontrolę typów,
6. lint,
7. produkcyjne bundlowanie esbuild.

Bundler tworzy:

```text
dist/extension.js
```

Projekt korzysta z pełnego ESM. `esbuild.js` generuje bundle o formacie `esm`, a konfiguracja TypeScript używa `NodeNext`.

W trybie watch można uruchomić:

```powershell
npm run watch
```

Tryb watch nie tworzy końcowego pakietu VSIX.

## 5. Wersja i nazwa rozszerzenia

Aktualne ręczne źródło nazwy i wersji to:

```text
metadata/project.json
```

Przykład:

```json
{
  "name": "cli-helper",
  "displayName": "CMDR Tools",
  "version": "0.3.322"
}
```

Wszystkie trzy wartości można zmieniać wyłącznie w tym pliku.

Po zmianie uruchom:

```powershell
npm run prepare:metadata
```

Proces wygeneruje `package.json`, zsynchronizuje `package-lock.json` i zweryfikuje zgodność danych.

Nie należy ręcznie podmieniać:

- `name` ani `version` w `package.json`,
- `name` ani `version` w `package-lock.json`,
- numeru wersji w wygenerowanym nazwie VSIX.

Nazwa pliku VSIX jest tworzona na podstawie wygenerowanego manifestu, np.:

```text
cli-helper-0.3.322.vsix
```

## Lokalny build

Dostępny skrót Make buduje produkcyjny pakiet tym samym pipeline'em co bezpośredni skrypt npm:

```powershell
make build
```

Komenda wykonuje `npm run build:full`, czyli produkcyjny build, synchronizację metadanych i pakowanie VSIX. Plik jest zapisany w katalogu głównym projektu, np.:

```text
cli-helper-0.3.322.vsix
```

## Przygotowanie i publikacja wydania

Przed wydaniem ustal wersję wyłącznie w `metadata/project.json`. Wówczas uruchom:

```powershell
make release
```

Komenda najpierw wykonuje `npm run prepare:metadata`. Następnie, jeżeli tylko pliki wydania `metadata/project.json`, `package.json` i `package-lock.json` są zmienione, tworzy dla nich jeden commit `chore: release vX.Y.Z`, wypycha go do bieżącej gałęzi i dopiero później tworzy oraz wypycha tag `vX.Y.Z`. Skrypt nie tworzy commitów ani nie stage'uje innych plików użytkownika i zatrzymuje się, gdy working tree zawiera niezwiązane zmiany.

Wypchnięcie taga uruchamia `.github/workflows/release.yml`. GitHub Actions:

1. pobiera repozytorium i instaluje Node.js 22,
2. wykonuje `npm ci`,
3. weryfikuje zgodność taga z wersjami w manifestach,
4. uruchamia testy, kontrolę typów, lint i walidację metadanych,
5. wykonuje `npm run build:full` i generuje VSIX,
6. tworzy GitHub Release powiązany z tagiem i załącza plik VSIX.

Workflow nie publikuje rozszerzenia na VS Code Marketplace. Gotowy pakiet pobierzesz z strony GitHub Releases repozytorium:

```text
https://github.com/ZeroDayZ7/cli-helper-cmdr-extension-vscode/releases
```

## 6. Pakowanie lokalnego VSIX

Pakowanie jedną komendą:

```powershell
npm run package:vsix
```

Skrypt wykonuje:

1. `npm run build:prod`,
2. `vsce package`.

Otwarty build przechodzi przez:

- regenerację manifestu,
- synchronizację lockfile,
- kontrolę metadanych,
- kontrolę typów,
- lint,
- produkcyjny esbuild,
- pakowanie VSIX.

Dodatkowy istniejący skrót:

```powershell
npm run build:full
```

Ma taki sam efekt jak `npm run package:vsix` i jest aliasem na potrzeby dotychczasowych procesów projektu.

Nie używaj ręcznie polecenia `vsce package` przed `npm run build:prod`, jeżeli zależy Ci na aktualnym manifestcie i produkcyjnym bundle.

## 7. Lokalizacja artefaktów

Wygenerowane artefakty:

```text
cli-helper-<wersja>.vsix
```

Plik VSIX jest zapisywany w katalogu głównym projektu:

```text
C:\Users\Neo\Desktop\WWW\vscode\cli-helper\cli-helper-<wersja>.vsix
```

Produkcyjny bundle:

```text
C:\Users\Neo\Desktop\WWW\vscode\cli-helper\dist\extension.js
```

Pliki kompilacji testów:

```text
C:\Users\Neo\Desktop\WWW\vscode\cli-helper\out\
```

Pliki `.vsix`, `dist/`, `out/` i `node_modules/` nie powinny być traktowane jako źródła kodu. Są artefaktami lub zależnościami lokalnymi.

## 8. Instalacja i test lokalnego VSIX

Nie publikuj pakietu automatycznie. Aby zainstalować lokalny VSIX w VS Code:

```powershell
code --install-extension cli-helper-0.3.322.vsix
```

Dla konkretnego builda zastąp nazwę pliku właściwą wersją.

Można także zainstalować go z VS Code: **Extensions → … → Install from VSIX**.

Po instalacji:

1. uruchom ponownie VS Code,
2. otwórz Command Palette,
3. wpisz `CMDR`,
4. uruchom jedną z istniejących komend rozszerzenia.

Jeżeli rozwijasz aktywną wersję rozszerzenia, testuj najczęściej bez instalacji pliku VSIX: uruchamiaj projekt przez konfigurację testową `npm test` lub z użyciem Extension Development Host.

## 9. Jedna komenda na pełny cykl

Standardowy pełny lokalny proces:

```powershell
npm ci
npm run gen-manifest
npm run validate:metadata
npm run test:manifest
npm run check-types
npm run lint
npm run compile
npm run compile-tests
npm test
npm run build:prod
npx vsce ls
npm run package:vsix
```

Zwykle codzienne odświeżenie projektu można skrócić do:

```powershell
npm test
npm run package:vsix
```

`npm test` automatycznie uruchamia testy manifestu, kompilację testów i kompilację rozszerzenia. `npm run package:vsix` ponownie wykonuje produkcyjny build i synchronizuje centralne metadane.

Nie należy wykonywać `npm ci` przy każdej drobnej zmianie. Jest to potrzebne do czystego środowiska, zmiany zależności lub problemów z node_modules.

## 10. Kontrola zawartości VSIX

Przed pakowaniem można sprawdzić, co zostanie dołączone:

```powershell
npx vsce ls
```

Kontrola powinna pokazać przede wszystkim:

- `README.md`,
- `package.json`,
- `LICENSE`,
- `icon.png`,
- `CHANGELOG.md`,
- `dist/extension.js`.

Nie powinny być dołączane:

- `src/`,
- `scripts/`,
- `metadata/`,
- `node_modules/`,
- `out/`,
- pliki `*.vsix`,
- inne pliki deweloperskie.

Reguły znajdują się w `.vscodeignore`.

## 11. Najczęstsze problemy

### `package.json` różni się od metadanych

Uruchom:

```powershell
npm run prepare:metadata
```

### `package-lock.json` nie jest zaktualizowany

```powershell
npm run sync:metadata
npm run validate:metadata
```

### Testy próbują pobierać VS Code

Sprawdź `.vscode-test.mjs` i istnienie lokalnego pliku:

```powershell
Test-Path "C:\Users\Neo\AppData\Local\Programs\Microsoft VS Code\Code.exe"
```

Jeżeli istnieje, konfiguracja testów powinna użyć go bez pobierania nowej dystrybucji.

### Brakuje `vsce`

Sprawdź dostępność narzędzia:

```powershell
npx vsce --version
```

Nie instaluj globalnej wersji, jeżeli można korzystać z narzędzia dołączonego do projektowego środowiska.

### Lint lub typy nie przechodzą

Najpierw uruchom pojedynczo:

```powershell
npm run check-types
npm run lint
```

Napraw wynikowe błędy przed pakowaniem.

### Pakiet jest stary

W pierwszej kolejności uruchom:

```powershell
npm run build:prod
```

Następnie ponownie sprawdź zawartość i spakuj:

```powershell
npx vsce ls
npm run package:vsix
```

## 12. Szybka lista kontrolna

- [ ] Zmiany w kodzie zapisane.
- [ ] Wersja, jeżeli zmieniana, ustawiona wyłącznie w `metadata/project.json`.
- [ ] Zależności zgodne z `package-lock.json`.
- [ ] `npm run gen-manifest` wykonane.
- [ ] `npm run validate:metadata` wykonane.
- [ ] Testy generatora wykonane.
- [ ] Typy i lint przechodzą.
- [ ] Testy VS Code przechodzą z lokalnym Code.exe.
- [ ] Produkcyjny bundle utworzony w `dist/extension.js`.
- [ ] Zawartość VSIX sprawdzona przez `npx vsce ls`.
- [ ] Wygenerowany plik VSIX znajduje się w katalogu projektu.

Wersję zmieniasz tylko w `metadata/project.json`. Następnie uruchom `npm run prepare:metadata`, przejrzyj wygenerowane `package.json` i `package-lock.json`, zatwierdź wszystkie zmiany zwykłym commitem i wypchnij gałąź do `origin`. Dopiero wtedy uruchom `make release`.

Komenda `make release` tylko weryfikuje wersje i czystość working tree, a następnie tworzy i wypycha tag `vX.Y.Z`. Nie uruchamia generatora, nie tworzy commitów ani nie wypycha commita gałęzi. Jeśli manifesty nie są zsynchronizowane lub working tree nie jest czysty, release zostaje zatrzymany.
