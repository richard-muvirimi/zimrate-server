{{--@formatter:off--}}
<x-mail::message>
# {{ config('app.name') }} Site Scraping Status!

@if( $rates->count() > 0 )
### {{ $rates->count() }} rates where not successfully scraped in the last 24 hrs.

<x-mail::panel>
@foreach ($rates as $index => $rate)
{{ $rate->id }}. [{{ $rate->name }}]({{ $rate->url }})
    - Rate: {{ $rate->rate . $rate->currency_base}}
    - Checked: {{ $rate->updated_at->format("M d, H:m") }} ({{ $rate->updated_at->diffForHumans() }})
    - Message: {{ $rate->status_message }}
    <br>
@endforeach
</x-mail::panel>
@else
### All rates where successfully scraped in the period leading upto the last 6 hrs.
@endif

Thanks,<br>

{{ config('app.name') }}

<x-mail::button :url="url('status')" color="primary">
    View In Browser
</x-mail::button>

</x-mail::message>
{{--@formatter:on--}}
