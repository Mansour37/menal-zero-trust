$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$sourceRoots = @(
    (Join-Path $workspaceRoot 'latex\frontmatter'),
    (Join-Path $workspaceRoot 'latex\chapters\final'),
    (Join-Path $workspaceRoot 'latex\appendices')
)

$tableFiles = Get-ChildItem -LiteralPath $sourceRoots -Filter '*.tex' -File -Recurse |
    Where-Object {
        Select-String -LiteralPath $_.FullName -Pattern '\begin{tabular}', '\begin{longtable}' -SimpleMatch -Quiet
    }

foreach ($file in $tableFiles) {
    $lines = [System.Collections.Generic.List[string]](Get-Content -LiteralPath $file.FullName)
    $output = [System.Collections.Generic.List[string]]::new()
    $insideTable = $false
    $tableEnvironment = $null

    for ($index = 0; $index -lt $lines.Count; $index++) {
        $line = $lines[$index]

        if (-not $insideTable -and $line -match '^(?<prefix>\s*\\begin\{(?<environment>tabular|longtable)\})\{(?<specification>.+)\}(?<suffix>\s*)$') {
            $specification = $Matches.specification -replace '@\{\}', ''
            $tokens = [regex]::Matches($specification, 'P\{[^}]+\}|[clr]') | ForEach-Object { $_.Value }
            if (($tokens -join '') -ne $specification) {
                throw "Spécification de colonnes non prise en charge dans $($file.FullName): $specification"
            }

            $closedSpecification = '|' + ($tokens -join '|') + '|'
            $line = $Matches.prefix + '{' + $closedSpecification + '}' + $Matches.suffix
            $insideTable = $true
            $tableEnvironment = $Matches.environment
            $output.Add($line)
            continue
        }

        if ($insideTable) {
            $line = $line -replace '\\(?:toprule|midrule|bottomrule)', '\hline'

            $isRow = $line -match '\\\\(?:\[[^\]]+\])?\s*(?:%.*)?$'
            $hasLine = $line -match '\\hline'
            $isCaption = $line -match '\\caption(?:\[|\{)'

            if ($isRow -and -not $hasLine -and -not $isCaption) {
                $nextSignificant = ''
                for ($lookAhead = $index + 1; $lookAhead -lt $lines.Count; $lookAhead++) {
                    $candidate = $lines[$lookAhead].Trim()
                    if ($candidate -and -not $candidate.StartsWith('%')) {
                        $nextSignificant = $candidate
                        break
                    }
                }

                $nextProvidesLine = $nextSignificant -match '^\\(?:toprule|midrule|bottomrule|hline)'
                $nextEndsTableHead = $nextSignificant -match '^\\(?:endfirsthead|endhead|endfoot|endlastfoot)'
                $nextEndsTable = $nextSignificant -match '^\\end\{(?:tabular|longtable)\}'

                if (-not $nextProvidesLine -and -not $nextEndsTableHead -and -not $nextEndsTable) {
                    $line = [regex]::Replace(
                        $line,
                        '(\\\\(?:\[[^\]]+\])?)(\s*)(%.*)?$',
                        '$1 \hline$2$3'
                    )
                }
            }

            if ($line -match ('^\s*\\end\{' + [regex]::Escape($tableEnvironment) + '\}')) {
                $insideTable = $false
                $tableEnvironment = $null
            }
        }

        $output.Add($line)
    }

    if ($insideTable) {
        throw "Environnement de tableau non fermé dans $($file.FullName)"
    }

    $newContent = ($output -join "`r`n") + "`r`n"
    [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.UTF8Encoding]::new($false))
}

Write-Output ("Tableaux fermés dans {0} fichiers." -f $tableFiles.Count)
