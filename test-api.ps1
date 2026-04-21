$apiKey = "bco_Mk7aq2D2jUEqLlOwHANpGhU8ZaI6l8Sx"
$base   = "https://buildchangeorder.co"

# Usage check
Write-Host "--- Usage ---"
try {
    $u = Invoke-RestMethod -Uri "$base/api/v1/usage" -Headers @{"X-API-Key"=$apiKey}
    $u | ConvertTo-Json
} catch { Write-Host "Error: $($_.Exception.Response.StatusCode)" }

# Generate a change order PDF
Write-Host "`n--- Generate ---"
$payload = @{
    from = @{ name="Acme Agency"; email="hello@acme.com" }
    to   = @{ name="BigCo Corp"; email="client@bigco.com" }
    change_order = @{ number="CO-001"; date="2026-04-19"; project="Website Redesign" }
    original_contract = @{ reference="Web Design Agreement"; date="2026-03-01"; value=5000; previous_change_orders=0 }
    items = @(@{ description="Add e-commerce checkout flow"; quantity=1; rate=1500 })
    reason = "client_request"
    description = "Client requested a full e-commerce checkout flow not in original scope."
    impact = @{ days_added=7; new_completion_date="2026-05-15" }
    tax_rate = 0
    notes = "Work begins upon signed approval."
    terms = "Payment due within 14 days of completion."
    options = @{ color="#7C3AED" }
} | ConvertTo-Json -Depth 5

try {
    $g = Invoke-RestMethod -Uri "$base/api/v1/generate" -Method POST -ContentType "application/json" -Body $payload -Headers @{"X-API-Key"=$apiKey}
    Write-Host "co_number: $($g.co_number)"
    Write-Host "new_contract_total: $($g.totals.new_contract_total)"
    Write-Host "pdf_size_bytes: $($g.size_bytes)"
    Write-Host "watermark: $($g.watermark)"
    Write-Host "remaining: $($g.usage.remaining)"
    # Save PDF
    $pdfBytes = [Convert]::FromBase64String($g.pdf)
    [IO.File]::WriteAllBytes("$PWD\test-output.pdf", $pdfBytes)
    Write-Host "PDF saved: test-output.pdf"
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        Write-Host "Error $($resp.StatusCode): $($reader.ReadToEnd())"
    } else { Write-Host "Error: $($_.Exception.Message)" }
}
