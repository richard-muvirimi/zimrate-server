<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Http\Request;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Symfony\Component\DomCrawler\Crawler;
use TijsVerkoyen\CssToInlineStyles\CssToInlineStyles;

class Resume extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(protected Request $request)
    {
        //
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address('noreply@tyganeutronics.com', 'richard@tyganeutronics.com'),
            to: new Address($this->request->get('email'), $this->request->get('email')),
            cc: new Address('richard@tyganeutronics.com', 'richard@tyganeutronics.com'),
            replyTo: new Address('richard@tyganeutronics.com', 'richard@tyganeutronics.com'),
            subject: $this->request->get('subject')
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $crawler = new Crawler();
        $crawler->addHtmlContent($this->request->get('template'));

        $crawler = $this->inlineStyles($crawler);

        return new Content(
            htmlString: $crawler->outerHtml(),
        );
    }

    /**
     * Inline the CSS for the message.
     */
    public function inlineStyles(Crawler $crawler): Crawler
    {
        $cssToInlineStyles = new CssToInlineStyles();

        // Find all the link tags with rel="stylesheet"
        $links = $crawler->filterXPath('//link[@rel="stylesheet"]');

        // Replace each link tag with an embedded stylesheet
        foreach ($links as $link) {
            $href = $link->getAttribute('href');

            $link->parentNode->removeChild($link);

            $template = $cssToInlineStyles->convert(
                $crawler->outerHtml(),
                file_get_contents($href)
            );

            $crawler = new Crawler();
            $crawler->addHtmlContent($template);
        }

        return $crawler;
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        $files = $this->request->files;

        if ($files->has('attachments')) {
            return collect($files->get('attachments'))->map(function ($file) {
                return Attachment::fromPath($file->getPathname())
                    ->as($file->getClientOriginalName())
                    ->withMime($file->getMimeType());
            })->toArray();
        } else {
            return [];
        }
    }
}
