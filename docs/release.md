# Release CMDR Tools

1. Wprowadź i przetestuj zmiany w kodzie.
2. Zmień wersję wyłącznie w `metadata/project.json`, np. `0.3.325`.
3. Uruchom synchronizację metadanych:

```powershell
make metadata
```

4. Sprawdź wygenerowane zmiany `package.json` i `package-lock.json`.
5. Zrób zwykły commit i wypchnij gałąź:

```powershell
git add metadata/project.json package.json package-lock.json
git commit -m "chore: release v0.3.325"
git push origin master
```

Jeżeli commitujesz też inne zmiany, dodaj je normalnie przed wydaniem.

6. Upewnij się, że working tree jest czysty:

```powershell
git status
```

7. Utwórz i wypchnij tag wydania:

```powershell
make release
```

`make release`:

- sprawdza wersję semantyczną `X.Y.Z`,
- sprawdza zgodność centralnych metadanych i lockfile,
- wymaga czystego working tree,
- sprawdza istnienie taga lokalnie i na `origin`,
- tworzy tag `vX.Y.Z` i wypycha go do GitHub.

`make release` nie zmienia kodu, nie generuje metadanych i nie tworzy commitów.

Wypchnięcie taga uruchamia GitHub Actions, które wykonują testy i budują VSIX. Gotowy pakiet znajdziesz w GitHub Releases:

```text
https://github.com/ZeroDayZ7/cli-helper-cmdr-extension-vscode/releases
```
